"""
Predictive Behavior Detection Engine for CipherWatch.

Implements deterministic session reconstruction, behavior template matching,
finite state machine (FSM) evaluation, dynamic risk and confidence calculation,
future step prediction, and MITRE ATT&CK technique mapping.
"""

from datetime import datetime, timedelta
import glob
import json
import logging
import os
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.orm import Session

from backend.db.models import BehavioralSessionModel

logger = logging.getLogger("cipherwatch.predictive_engine")


class BehaviorTemplateLoader:
    """Dynamically loads and caches attack chain behavior templates from JSON files."""

    def __init__(self, templates_dir: Optional[str] = None):
        if not templates_dir:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            templates_dir = os.path.join(base_dir, "behavior_templates")
        self.templates_dir = templates_dir
        self.templates: Dict[str, Dict[str, Any]] = {}
        self.load_templates()

    def load_templates(self) -> int:
        """Scan directory and parse all JSON template files."""
        self.templates.clear()
        if not os.path.exists(self.templates_dir):
            logger.warning(f"Behavior templates directory not found: {self.templates_dir}")
            return 0

        json_files = glob.glob(os.path.join(self.templates_dir, "*.json"))
        for filepath in json_files:
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    tpl = json.load(f)
                    tpl_id = tpl.get("id")
                    if tpl_id:
                        self.templates[tpl_id] = tpl
                        logger.info(f"Loaded behavior template: '{tpl.get('name')}' ({tpl_id})")
            except Exception as e:
                logger.error(f"Failed to parse behavior template at {filepath}: {e}")

        return len(self.templates)

    def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        return self.templates.get(template_id)

    def get_all_templates(self) -> List[Dict[str, Any]]:
        return list(self.templates.values())


class EventStageMatcher:
    """Evaluates whether an event matches a specific behavior template stage rule."""

    @staticmethod
    def matches_stage(event: Dict[str, Any], stage_spec: Dict[str, Any]) -> bool:
        expected_type = stage_spec.get("event_type")
        actual_type = event.get("event_type")

        # Generic mapping check
        if expected_type and actual_type:
            # Match process_event vs process, fs_event vs fs, usb_event vs usb
            exp_clean = expected_type.replace("_event", "")
            act_clean = str(actual_type).replace("_event", "")
            if exp_clean != act_clean and expected_type != "any":
                # Check sub-properties if types don't strictly align
                if not (exp_clean == "fs" and "src_path" in event) and \
                   not (exp_clean == "usb" and ("vendor_id" in event or "action" in event)) and \
                   not (exp_clean == "process" and ("pid" in event or "cmdline" in event)):
                    return False

        matcher = stage_spec.get("matcher", {})

        # 1. Match Actions (e.g. connected, modified, deleted)
        if "action" in matcher:
            event_action = str(event.get("action") or event.get("event_type") or "").lower()
            expected_actions = [a.lower() for a in matcher["action"]]
            if not any(ea in event_action for ea in expected_actions):
                return False

        # 2. Match CMDLine / Process Keywords
        if "cmdline_keywords" in matcher:
            cmdline = str(event.get("cmdline") or event.get("name") or event.get("exe_path") or "").lower()
            expected_kw = [k.lower() for k in matcher["cmdline_keywords"]]
            if not any(kw in cmdline for kw in expected_kw):
                return False

        # 3. Match Path Keywords
        if "path_keywords" in matcher:
            path_str = str(event.get("src_path") or event.get("dest_path") or event.get("path") or event.get("cmdline") or "").lower()
            expected_kw = [k.lower() for k in matcher["path_keywords"]]
            if not any(kw in path_str for kw in expected_kw):
                return False

        # 4. Match File Extensions
        if "extension" in matcher:
            path_str = str(event.get("src_path") or event.get("dest_path") or "").lower()
            expected_exts = [e.lower() for e in matcher["extension"]]
            if not any(path_str.endswith(ext) for ext in expected_exts):
                return False

        return True


class BehavioralSession:
    """In-memory finite state machine tracking a single behavioral session."""

    def __init__(self, template: Dict[str, Any], agent_id: str, user_id: str, org_id: str = None, device_id: str = "unknown_device"):
        self.session_id = f"bsess_{uuid.uuid4().hex[:12]}"
        self.template = template
        self.template_id = template["id"]
        self.template_name = template["name"]
        self.agent_id = agent_id
        self.user_id = user_id
        self.org_id = org_id
        self.device_id = device_id

        self.stages = template.get("stages", [])
        self.total_stages = len(self.stages)
        self.current_stage = 1

        self.start_time = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.status = "active"  # active | completed | expired

        self.recent_events: List[Dict[str, Any]] = []
        self.mitre_techniques: List[Dict[str, str]] = []

        # Initial metrics from stage 1
        st1 = self.stages[0] if self.stages else {}
        self.risk_score = float(st1.get("risk", 0.0))
        self.confidence_score = float(st1.get("confidence", 20.0))

        pred = st1.get("prediction", {})
        self.predicted_next_action = pred.get("action", "Next Attack Stage")
        self.predicted_probability = float(pred.get("probability", 75.0))
        self.estimated_time_seconds = int(pred.get("estimated_time_seconds", 120))

        if st1.get("mitre"):
            self.mitre_techniques.append(st1["mitre"])

    def advance_stage(self, event: Dict[str, Any], matched_stage_idx: int) -> bool:
        """Advance state machine to matched stage index (0-indexed)."""
        now = datetime.utcnow()
        time_delta_sec = (now - self.last_activity).total_seconds()
        self.last_activity = now

        # Update current stage
        target_stage_num = matched_stage_idx + 1
        if target_stage_num <= self.current_stage and self.current_stage > 1:
            # Repeat event on current stage - increment risk slightly
            self.risk_score = min(100.0, self.risk_score + 2.0)
            self._add_recent_event(event, f"Repeat Activity in Stage {self.current_stage}")
            return False

        self.current_stage = target_stage_num
        st_spec = self.stages[matched_stage_idx]

        # Calculate Non-Linear Risk Progression
        base_risk = float(st_spec.get("risk", self.risk_score + 20.0))
        # Velocity multiplier: Rapid progression (< 60 seconds between stages) elevates risk
        velocity_bonus = 10.0 if time_delta_sec < 60.0 else 0.0
        self.risk_score = min(100.0, base_risk + velocity_bonus)

        # Calculate Confidence Progression
        base_confidence = float(st_spec.get("confidence", self.confidence_score + 15.0))
        # Sequence consistency bonus: Exact sequential order increases match confidence
        self.confidence_score = min(100.0, base_confidence)

        # Prediction Updates
        pred = st_spec.get("prediction", {})
        self.predicted_next_action = pred.get("action", "Attack Sequence Complete")
        self.predicted_probability = float(pred.get("probability", 95.0))
        self.estimated_time_seconds = int(pred.get("estimated_time_seconds", 0))

        # MITRE Technique Accumulation
        if st_spec.get("mitre"):
            mitre_info = st_spec["mitre"]
            if not any(m.get("technique_id") == mitre_info.get("technique_id") for m in self.mitre_techniques):
                self.mitre_techniques.append(mitre_info)

        # Add event to history
        self._add_recent_event(event, f"Advanced to Stage {self.current_stage}: {st_spec.get('name')}")

        # Check if attack sequence completed
        if self.current_stage >= self.total_stages:
            self.status = "completed"
            self.predicted_next_action = "Attack Sequence Completed"
            self.predicted_probability = 100.0
            self.estimated_time_seconds = 0

        return True

    def apply_inactivity_decay(self, timeout_minutes: int = 15) -> bool:
        """Decay risk score when session is idle. Close if idle past timeout."""
        if self.status != "active":
            return False

        idle_seconds = (datetime.utcnow() - self.last_activity).total_seconds()
        idle_minutes = idle_seconds / 60.0

        if idle_minutes >= timeout_minutes:
            self.status = "expired"
            self.risk_score = max(0.0, self.risk_score * 0.5)
            logger.info(f"Behavioral session '{self.session_id}' expired due to {idle_minutes:.1f}m inactivity.")
            return True
        elif idle_minutes >= 5.0:
            # Gradual decay after 5 minutes of idle
            decay_factor = 0.95 ** (idle_minutes - 5.0)
            self.risk_score = max(5.0, self.risk_score * decay_factor)

        return False

    def _add_recent_event(self, event: Dict[str, Any], note: str):
        ev_summary = {
            "timestamp": datetime.utcnow().isoformat(),
            "desc": event.get("desc") or event.get("name") or event.get("src_path") or event.get("action") or "Telemetry Event",
            "event_type": event.get("event_type", "unknown"),
            "note": note
        }
        self.recent_events.append(ev_summary)
        if len(self.recent_events) > 10:
            self.recent_events.pop(0)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "template_id": self.template_id,
            "template_name": self.template_name,
            "agent_id": self.agent_id,
            "user_id": self.user_id,
            "org_id": self.org_id,
            "device_id": self.device_id,
            "current_stage": self.current_stage,
            "total_stages": self.total_stages,
            "risk_score": round(self.risk_score, 1),
            "confidence_score": round(self.confidence_score, 1),
            "predicted_next_action": self.predicted_next_action,
            "predicted_probability": round(self.predicted_probability, 1),
            "estimated_time_seconds": self.estimated_time_seconds,
            "current_mitre_technique": self.mitre_techniques[-1]["technique_id"] if self.mitre_techniques else "T1000",
            "mitre_techniques": self.mitre_techniques,
            "recent_events": self.recent_events,
            "status": self.status,
            "start_time": self.start_time.isoformat(),
            "last_activity": self.last_activity.isoformat()
        }


class PredictiveBehaviorEngine:
    """Master orchestrator for behavior templates, session reconstruction, and predictions."""

    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(PredictiveBehaviorEngine, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "initialized", False):
            return
        self.loader = BehaviorTemplateLoader()
        self.active_sessions: Dict[str, BehavioralSession] = {}  # session_id -> BehavioralSession
        self.initialized = True

    def reload_templates(self) -> int:
        return self.loader.load_templates()

    def process_event(self, db: Session, event_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Process incoming telemetry event against all behavioral sessions & templates."""
        agent_id = event_data.get("agent_id") or "agent_default"
        user_id = event_data.get("user_id") or "user_default"
        org_id = event_data.get("org_id")
        device_id = event_data.get("device_id") or "unknown_device"

        # 1. Sweep inactive sessions
        self._sweep_inactive_sessions(db)

        updated_sessions: List[BehavioralSession] = []

        # 2. Check event against existing active sessions for stage progression
        for sess_id, sess in list(self.active_sessions.items()):
            if sess.agent_id == agent_id and sess.status == "active":
                next_stage_idx = sess.current_stage  # 0-indexed next stage
                if next_stage_idx < sess.total_stages:
                    next_stage_spec = sess.stages[next_stage_idx]
                    if EventStageMatcher.matches_stage(event_data, next_stage_spec):
                        sess.advance_stage(event_data, next_stage_idx)
                        self._persist_session(db, sess)
                        updated_sessions.append(sess)

        # 3. Check event against Stage 1 of ALL templates to initiate new sessions
        all_templates = self.loader.get_all_templates()
        for tpl in all_templates:
            stages = tpl.get("stages", [])
            if not stages:
                continue

            stage1_spec = stages[0]
            if EventStageMatcher.matches_stage(event_data, stage1_spec):
                # Check if session for this template is already active for this agent
                already_active = any(
                    s.agent_id == agent_id and s.template_id == tpl["id"] and s.status == "active"
                    for s in self.active_sessions.values()
                )
                if not already_active:
                    new_sess = BehavioralSession(
                        template=tpl,
                        agent_id=agent_id,
                        user_id=user_id,
                        org_id=org_id,
                        device_id=device_id
                    )
                    new_sess._add_recent_event(event_data, f"Initiated Stage 1: {stage1_spec.get('name')}")
                    self.active_sessions[new_sess.session_id] = new_sess
                    self._persist_session(db, new_sess)
                    updated_sessions.append(new_sess)

        return [s.to_dict() for s in updated_sessions]

    def get_active_sessions(self, db: Session, org_id: Optional[str] = None, agent_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve active behavioral sessions from memory & DB."""
        self._sweep_inactive_sessions(db)
        
        # Also sync from DB if memory is empty
        if not self.active_sessions and db:
            db_sessions = db.query(BehavioralSessionModel).filter(BehavioralSessionModel.status == "active").all()
            for ds in db_sessions:
                tpl = self.loader.get_template(ds.template_id)
                if tpl:
                    bs = BehavioralSession(tpl, ds.agent_id, ds.user_id, ds.org_id, ds.device_id)
                    bs.session_id = ds.session_id
                    bs.current_stage = ds.current_stage
                    bs.risk_score = ds.risk_score
                    bs.confidence_score = ds.confidence_score
                    bs.predicted_next_action = ds.predicted_next_action or "Unknown"
                    bs.predicted_probability = ds.predicted_probability
                    bs.estimated_time_seconds = ds.estimated_time_seconds
                    bs.mitre_techniques = ds.mitre_techniques_json or []
                    bs.recent_events = ds.recent_events_json or []
                    bs.status = ds.status
                    self.active_sessions[bs.session_id] = bs

        results = []
        for s in self.active_sessions.values():
            if s.status == "active":
                if org_id and s.org_id and s.org_id != org_id:
                    continue
                if agent_id and s.agent_id and s.agent_id != agent_id:
                    continue
                results.append(s.to_dict())

        return sorted(results, key=lambda x: x["risk_score"], reverse=True)

    def _sweep_inactive_sessions(self, db: Session):
        """Inactivity decay & session expiration sweep."""
        for sess_id, sess in list(self.active_sessions.items()):
            if sess.status == "active":
                expired = sess.apply_inactivity_decay(timeout_minutes=15)
                if expired:
                    self._persist_session(db, sess)

    def _persist_session(self, db: Session, sess: BehavioralSession):
        """Persist or update behavioral session in SQLAlchemy database."""
        if not db:
            return
        try:
            db_sess = db.query(BehavioralSessionModel).filter(BehavioralSessionModel.session_id == sess.session_id).first()
            if not db_sess:
                db_sess = BehavioralSessionModel(
                    session_id=sess.session_id,
                    org_id=sess.org_id,
                    agent_id=sess.agent_id,
                    user_id=sess.user_id,
                    device_id=sess.device_id,
                    template_id=sess.template_id,
                    template_name=sess.template_name,
                    start_time=sess.start_time
                )
                db.add(db_sess)

            db_sess.current_stage = sess.current_stage
            db_sess.total_stages = sess.total_stages
            db_sess.risk_score = sess.risk_score
            db_sess.confidence_score = sess.confidence_score
            db_sess.predicted_next_action = sess.predicted_next_action
            db_sess.predicted_probability = sess.predicted_probability
            db_sess.estimated_time_seconds = sess.estimated_time_seconds
            db_sess.current_mitre_technique = sess.mitre_techniques[-1]["technique_id"] if sess.mitre_techniques else "T1000"
            db_sess.mitre_techniques_json = sess.mitre_techniques
            db_sess.recent_events_json = sess.recent_events
            db_sess.status = sess.status
            db_sess.last_activity = sess.last_activity
            if sess.status != "active":
                db_sess.closed_at = datetime.utcnow()

            db.commit()
        except Exception as e:
            logger.error(f"Error persisting behavioral session {sess.session_id}: {e}")
            db.rollback()


# Global Singleton Instance
predictive_engine = PredictiveBehaviorEngine()
