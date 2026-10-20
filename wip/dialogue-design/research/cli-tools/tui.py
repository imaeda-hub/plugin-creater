# TUI driver: python3 tui.py <steps.json> <outdir> -- <cmd...>
# steps: [["wait",sec],["waitfor","regex",timeout],["send","text"],["snap","name"]]
# Special send tokens: "<ENTER>" "<ESC>" "<DOWN>" "<UP>" "<TAB>" "<CTRLC>" "<CTRLS>" "<CTRLD>"
import sys, os, pty, json, time, select, re, fcntl, termios, struct, signal
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'venv-tools', 'py'))
import pyte

steps = json.load(open(sys.argv[1]))
outdir = sys.argv[2]
cmd = sys.argv[sys.argv.index('--') + 1:]
COLS, ROWS = int(os.environ.get('TUI_COLS', 140)), int(os.environ.get('TUI_ROWS', 50))
os.makedirs(outdir, exist_ok=True)
class SafeScreen(pyte.Screen):
    pass
import functools, inspect
for _n, _f in list(vars(pyte.Screen).items()):
    if callable(_f) and not _n.startswith('__'):
        def _mk(f):
            @functools.wraps(f)
            def w(self, *a, **k):
                try:
                    return f(self, *a, **k)
                except TypeError:
                    k.pop('private', None)
                    try: return f(self, *a, **k)
                    except Exception: return None
            return w
        setattr(SafeScreen, _n, _mk(_f))
screen = SafeScreen(COLS, ROWS)
stream = pyte.ByteStream(screen)
raw = open(os.path.join(outdir, 'raw.bin'), 'wb')

pid, fd = pty.fork()
if pid == 0:
    os.environ['TERM'] = 'xterm-256color'
    os.execvp(cmd[0], cmd)
fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', ROWS, COLS, 0, 0))

def pump(t):
    end = time.time() + t
    while True:
        rem = end - time.time()
        if rem <= 0: return
        r, _, _ = select.select([fd], [], [], min(rem, 0.1))
        if r:
            try: data = os.read(fd, 65536)
            except OSError: return
            if not data: return
            raw.write(data)
            # answer terminal queries minimally (cursor position report)
            if b'\x1b[6n' in data:
                os.write(fd, b'\x1b[1;1R')
            stream.feed(data)

def text():
    return '\n'.join(line.rstrip() for line in screen.display)

KEYS = {'<ENTER>': '\r', '<ESC>': '\x1b', '<DOWN>': '\x1b[B', '<UP>': '\x1b[A', '<TAB>': '\t',
        '<CTRLC>': '\x03', '<CTRLS>': '\x13', '<CTRLD>': '\x04', '<RIGHT>': '\x1b[C', '<LEFT>': '\x1b[D',
        '<SPACE>': ' ', '<BS>': '\x7f', '<CTRLENTER>': '\x1b[13;5u'}
log = []
for st in steps:
    kind = st[0]
    if kind == 'wait': pump(st[1])
    elif kind == 'waitfor':
        rx = re.compile(st[1]); end = time.time() + st[2]; ok = False
        while time.time() < end:
            pump(0.3)
            if rx.search(text()): ok = True; break
        log.append(['waitfor', st[1], ok])
    elif kind == 'send':
        s = st[1]
        for k, v in KEYS.items(): s = s.replace(k, v)
        for ch in s:
            os.write(fd, ch.encode()); pump(0.02)
    elif kind == 'sh':
        import subprocess; subprocess.run(st[1], shell=True)
    elif kind == 'snap':
        open(os.path.join(outdir, 'snap-' + st[1] + '.txt'), 'w').write(text())
        log.append(['snap', st[1]])
json.dump(log, open(os.path.join(outdir, 'log.json'), 'w'))
try:
    os.kill(pid, signal.SIGTERM)
except Exception: pass
pump(1)
try: os.kill(pid, signal.SIGKILL)
except Exception: pass
