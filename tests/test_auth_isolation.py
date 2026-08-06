"""
CipherWatch Multi-Tenant Auth & Cross-Org Isolation Test Suite

Tests:
1. User signup + login + JWT auth
2. Organization creation and credential retrieval
3. Agent registration with org registration key
4. CRITICAL: Cross-org isolation boundary — User A must NOT access User B's org data
"""
import sys

def run_auth_tests():
    print("=" * 60)
    print("CipherWatch Multi-Tenant Auth & Isolation Test Suite")
    print("=" * 60)

    from fastapi.testclient import TestClient
    from backend.main import app
    from backend.db.session import engine
    from backend.db.base import Base

    # Reset DB
    print("\n[SETUP] Resetting database schema...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("✓ Schema initialized.")

    client = TestClient(app)

    # ─── Stage 1: User A Signup ───────────────────────────────────
    print("\n[TEST 1] User A signup...")
    resp_a = client.post("/api/auth/signup", json={
        "email": "alice@acme.com",
        "username": "alice",
        "password": "securepass123",
        "org_name": "Acme Security Corp",
    })
    assert resp_a.status_code == 201, f"Expected 201, got {resp_a.status_code}: {resp_a.text}"
    data_a = resp_a.json()
    assert data_a["username"] == "alice"
    token_a = data_a["access_token"]
    user_a_id = data_a["user_id"]
    print(f"✓ User A registered: user_id={user_a_id}")

    # ─── Stage 2: User B Signup ───────────────────────────────────
    print("\n[TEST 2] User B signup...")
    resp_b = client.post("/api/auth/signup", json={
        "email": "bob@rival.com",
        "username": "bob",
        "password": "anotherpass456",
        "org_name": "Rival Inc",
    })
    assert resp_b.status_code == 201
    data_b = resp_b.json()
    token_b = data_b["access_token"]
    user_b_id = data_b["user_id"]
    print(f"✓ User B registered: user_id={user_b_id}")

    # ─── Stage 3: Duplicate signup rejection ──────────────────────
    print("\n[TEST 3] Duplicate email/username rejection...")
    dup_resp = client.post("/api/auth/signup", json={
        "email": "alice@acme.com",
        "username": "alice_dup",
        "password": "whatever123",
        "org_name": "Whatever",
    })
    assert dup_resp.status_code == 409, f"Expected 409, got {dup_resp.status_code}"
    print("✓ Duplicate email correctly rejected with 409.")

    # ─── Stage 4: Login ───────────────────────────────────────────
    print("\n[TEST 4] Login User A...")
    login_resp = client.post("/api/auth/login", json={
        "email": "alice@acme.com",
        "password": "securepass123",
    })
    assert login_resp.status_code == 200
    assert login_resp.json()["username"] == "alice"
    print("✓ Login successful.")

    print("\n[TEST 4b] Login with wrong password...")
    bad_login = client.post("/api/auth/login", json={
        "email": "alice@acme.com",
        "password": "wrongpass",
    })
    assert bad_login.status_code == 401
    print("✓ Wrong password correctly rejected with 401.")

    # ─── Stage 5: Get /me ─────────────────────────────────────────
    print("\n[TEST 5] GET /api/auth/me...")
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_a}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "alice"
    print("✓ /me returns correct user.")

    # ─── Stage 6: List orgs ───────────────────────────────────────
    print("\n[TEST 6] List User A orgs...")
    orgs_a = client.get("/api/orgs", headers={"Authorization": f"Bearer {token_a}"})
    assert orgs_a.status_code == 200
    org_list_a = orgs_a.json()
    assert len(org_list_a) == 1
    org_a_id = org_list_a[0]["id"]
    assert org_list_a[0]["name"] == "Acme Security Corp"
    print(f"✓ User A has 1 org: {org_a_id}")

    orgs_b = client.get("/api/orgs", headers={"Authorization": f"Bearer {token_b}"})
    org_list_b = orgs_b.json()
    org_b_id = org_list_b[0]["id"]
    print(f"✓ User B has 1 org: {org_b_id}")

    # ─── Stage 7: Get registration credentials ───────────────────
    print("\n[TEST 7] Get org A registration credentials (as User A)...")
    creds_resp = client.get(
        f"/api/orgs/{org_a_id}/registration-credentials",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert creds_resp.status_code == 200
    creds = creds_resp.json()
    assert creds["org_id"] == org_a_id
    assert creds["registration_key"].startswith("cwrk_")
    reg_key_a = creds["registration_key"]
    print(f"✓ Got registration key for org A: {reg_key_a[:12]}...")

    # ─── Stage 8: Agent registration with org key ─────────────────
    print("\n[TEST 8] Register agent into Org A using registration key...")
    agent_reg = client.post("/api/agents/register", json={
        "hostname": "test-workstation-01",
        "os": "Linux 6.5.0",
        "ip": "10.0.1.50",
        "agent_version": "1.2.0",
        "org_id": org_a_id,
        "registration_key": reg_key_a,
    })
    assert agent_reg.status_code == 201, f"Expected 201, got {agent_reg.status_code}: {agent_reg.text}"
    agent_data = agent_reg.json()
    agent_id = agent_data["agent_id"]
    agent_token = agent_data["auth_token"]
    print(f"✓ Agent registered: {agent_id}")

    print("\n[TEST 8b] Agent registration with WRONG key...")
    bad_agent = client.post("/api/agents/register", json={
        "hostname": "evil-box",
        "os": "Kali",
        "ip": "10.0.99.1",
        "agent_version": "1.0.0",
        "org_id": org_a_id,
        "registration_key": "cwrk_this_is_fake",
    })
    assert bad_agent.status_code == 403
    print("✓ Invalid registration key correctly rejected with 403.")

    # ─── Stage 9: Org-scoped dashboard stats ──────────────────────
    print("\n[TEST 9] Org A dashboard stats (as User A)...")
    stats_resp = client.get(
        f"/api/admin/orgs/{org_a_id}/dashboard/stats",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["summary"]["total_systems"] >= 1
    print(f"✓ Org A has {stats['summary']['total_systems']} systems.")

    # ═══════════════════════════════════════════════════════════════
    # CRITICAL: Cross-Org Isolation Tests
    # ═══════════════════════════════════════════════════════════════
    print("\n" + "=" * 60)
    print("CRITICAL: Cross-Organization Isolation Boundary Tests")
    print("=" * 60)

    # Test 10: User B tries to access User A's org dashboard → 403
    print("\n[TEST 10] User B → Org A dashboard stats → MUST be 403...")
    cross_stats = client.get(
        f"/api/admin/orgs/{org_a_id}/dashboard/stats",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert cross_stats.status_code == 403, f"SECURITY FAILURE: Expected 403, got {cross_stats.status_code}"
    print("✓ PASS: User B blocked from Org A dashboard stats (403).")

    # Test 11: User B tries to list User A's org systems → 403
    print("\n[TEST 11] User B → Org A system list → MUST be 403...")
    cross_systems = client.get(
        f"/api/admin/orgs/{org_a_id}/systems",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert cross_systems.status_code == 403, f"SECURITY FAILURE: Expected 403, got {cross_systems.status_code}"
    print("✓ PASS: User B blocked from Org A system list (403).")

    # Test 12: User B tries to access User A's agent detail → 403
    print("\n[TEST 12] User B → Org A agent detail → MUST be 403...")
    cross_detail = client.get(
        f"/api/admin/orgs/{org_a_id}/systems/{agent_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert cross_detail.status_code == 403, f"SECURITY FAILURE: Expected 403, got {cross_detail.status_code}"
    print("✓ PASS: User B blocked from Org A agent detail (403).")

    # Test 13: User B tries to get Org A's registration credentials → 403
    print("\n[TEST 13] User B → Org A registration credentials → MUST be 403...")
    cross_creds = client.get(
        f"/api/orgs/{org_a_id}/registration-credentials",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert cross_creds.status_code == 403, f"SECURITY FAILURE: Expected 403, got {cross_creds.status_code}"
    print("✓ PASS: User B blocked from Org A registration credentials (403).")

    # Test 14: User B tries to access Org A's threats → 403
    print("\n[TEST 14] User B → Org A threats → MUST be 403...")
    cross_threats = client.get(
        f"/api/admin/orgs/{org_a_id}/threats",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert cross_threats.status_code == 403, f"SECURITY FAILURE: Expected 403, got {cross_threats.status_code}"
    print("✓ PASS: User B blocked from Org A threats (403).")

    # Test 15: User B tries to access Org A's timeline → 403
    print("\n[TEST 15] User B → Org A agent timeline → MUST be 403...")
    cross_timeline = client.get(
        f"/api/admin/orgs/{org_a_id}/systems/{agent_id}/timeline",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert cross_timeline.status_code == 403, f"SECURITY FAILURE: Expected 403, got {cross_timeline.status_code}"
    print("✓ PASS: User B blocked from Org A timeline (403).")

    # Test 16: Unauthenticated access → 401
    print("\n[TEST 16] Unauthenticated access → MUST be 401...")
    no_auth = client.get(f"/api/admin/orgs/{org_a_id}/dashboard/stats")
    assert no_auth.status_code == 401, f"Expected 401, got {no_auth.status_code}"
    print("✓ PASS: Unauthenticated request correctly rejected (401).")

    # ─── Stage 17: Verify User A can still access their own org ───
    print("\n[TEST 17] User A can still access own org after isolation tests...")
    own_stats = client.get(
        f"/api/admin/orgs/{org_a_id}/dashboard/stats",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert own_stats.status_code == 200
    print("✓ User A's own org access still works correctly.")

    # ─── Stage 18: Create additional org ──────────────────────────
    print("\n[TEST 18] User A creates second org...")
    new_org = client.post(
        "/api/orgs",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"name": "Acme DevOps Team"},
    )
    assert new_org.status_code == 201
    org_c_id = new_org.json()["id"]
    print(f"✓ Second org created: {org_c_id}")

    orgs_a_updated = client.get("/api/orgs", headers={"Authorization": f"Bearer {token_a}"})
    assert len(orgs_a_updated.json()) == 2
    print("✓ User A now has 2 orgs.")

    print("\n" + "=" * 60)
    print("🎉 ALL AUTH & ISOLATION TESTS PASSED (18/18)")
    print("=" * 60)


if __name__ == "__main__":
    try:
        run_auth_tests()
        sys.exit(0)
    except AssertionError as err:
        print(f"\n❌ TEST FAILED: {err}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    except Exception as err:
        print(f"\n❌ UNEXPECTED ERROR: {err}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
