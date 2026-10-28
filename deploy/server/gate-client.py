#!/usr/bin/env python3
"""Sends one request to kasra-gate from a deployment job and streams its output.

Usage: DEPLOY_TOKEN=... python3 gate-client.py <task> [args...]   (the token only in approved jobs)
The exit status is the gate task's (77 when the token is missing or wrong).
"""
import json
import os
import socket
import sys

SOCKET = os.environ.get("KASRA_GATE_SOCKET", "/run/kasra-gate.sock")
MARK = "__KASRA_GATE_EXIT__ "

request = {"task": sys.argv[1], "args": sys.argv[2:], "token": os.environ.get("DEPLOY_TOKEN", "").strip()}
connection = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
try:
    connection.connect(SOCKET)
except OSError as error:
    sys.exit("kasra-gate is not reachable at %s (%s): is the runner installed on the server?" % (SOCKET, error))
connection.sendall((json.dumps(request) + "\n").encode())
status = 1
with connection.makefile("r", encoding="utf-8", errors="replace") as replies:
    for line in replies:
        if line.startswith(MARK):
            status = int(line[len(MARK):].strip() or 1)
            break
        sys.stdout.write(line)
        sys.stdout.flush()
sys.exit(status)
