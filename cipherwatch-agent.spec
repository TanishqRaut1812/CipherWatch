# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

# Collect submodules
hidden_imports = [
    'agent',
    'agent.cli',
    'agent.config',
    'agent.paths',
    'agent.process_manager',
    'agent.publisher',
    'agent.runtime',
    'agent.service',
    'agent.utils',
    'agent.utils.machine_id',
    'agent.monitors',
    'agent.monitors.base',
    'agent.monitors.filesystem',
    'agent.monitors.network',
    'agent.monitors.privacy_toggles',
    'agent.monitors.process',
    'agent.monitors.usb',
    'shared',
    'shared.schemas',
    'httpx',
    'psutil',
    'watchdog',
    'watchdog.observers',
    'watchdog.events',
    'pydantic',
    'pydantic_core',
]

a = Analysis(
    ['agent/cli.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy', 'numpy', 'pytest'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='cipherwatch-agent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
