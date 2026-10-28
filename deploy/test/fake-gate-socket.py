#!/usr/bin/env python3
"""Test stand-in for kasra-gate.socket where systemd is not running (deploy-test.sh with SKIP_PROVISION):
listens on the gate socket and runs one kasra-gate per connection with the connection as stdin/stdout,
like systemd's Accept=yes. Usage: fake-gate-socket.py /run/kasra-gate.sock /usr/local/sbin/kasra-gate
"""
import os
import socket
import subprocess
import sys

path, gate = sys.argv[1], sys.argv[2]
if os.path.exists(path):
    os.remove(path)
server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
server.bind(path)
os.chmod(path, 0o660)
server.listen(4)
while True:
    connection, _ = server.accept()
    subprocess.Popen([gate], stdin=connection.fileno(), stdout=connection.fileno(), close_fds=True)
    connection.close()
