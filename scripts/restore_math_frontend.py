"""Restore a reviewed frontend revision without rolling back paper archives. Dry run by default."""
import argparse
from pathlib import Path
import re
import subprocess


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def frontend(path):
    return path.startswith('math-daily/') and not path.startswith('math-daily/data/')


def restore(revision, apply=False):
    if not re.fullmatch(r'[0-9a-fA-F]{7,40}', revision): raise ValueError('Use a verified Git commit SHA')
    commit=git('rev-parse','--verify',revision+'^{commit}')
    subprocess.run(['git','merge-base','--is-ancestor',commit,'HEAD'],check=True)
    if git('status','--porcelain'): raise ValueError('Checkout has local changes; save them before restoring')
    paths=set(filter(frontend,git('ls-files','math-daily').splitlines()))
    old=set(filter(frontend,git('ls-tree','-r','--name-only',commit,'math-daily').splitlines()))
    if 'math-daily/index.html' not in old: raise ValueError('Revision has no Math Daily page')
    for path in sorted(paths | old): print(path)
    if apply:
        # git restore removes newer tracked frontend files absent in the target.
        subprocess.run(['git','restore','--source='+commit,'--worktree','--',*sorted(paths|old)],check=True)
    return commit


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('revision');parser.add_argument('--apply',action='store_true');args=parser.parse_args();restore(args.revision,args.apply)
