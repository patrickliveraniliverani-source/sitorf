#!/usr/bin/env python3
import subprocess
import sys

def check_command(cmd):
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def main():
    print("Checking system dependencies...")
    deps = {
        "Node.js": ["node", "--version"],
        "npm": ["npm", "--version"],
        "Python 3": [sys.executable, "--version"]
    }
    
    all_ok = True
    for name, cmd in deps.items():
        if check_command(cmd):
            print(f"✅ {name} found.")
        else:
            print(f"❌ {name} NOT found.")
            all_ok = False
            
    if all_ok:
        print("\nAll dependencies are met. Ready to proceed.")
        sys.exit(0)
    else:
        print("\nSome dependencies are missing. Please install them before continuing.")
        sys.exit(1)

if __name__ == "__main__":
    main()
