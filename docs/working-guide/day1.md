DAY 1 — Toolchain & Hello-World (hour-by-hour, this is your danger zone) — DONE
Goal: a hello-world Soroban contract deployed to testnet and visible on stellar.expert. Nothing else.

Result:
- Testnet account: `GAC3WCB5ZZ5GVWDOL4XCA3UJU5ZQ4CCAODREOEDLJB5UT4Q6BZDKPYUK`
- Hello-world contract ID: `CAVWRKTKOY5CSNIBMES3GP2VBVRHSMELP6G5VJBBYOLI7QTIKUH3NOSS`
- Deploy transaction: `bb8f2b9bfec4243c5b0f910e1f0073270154618b2e70899af840ae3226ad1146`
- Invoke result: `["Hello","World"]`
Hour 0–1 · WSL2 is your home now — DONE

 Confirm you are inside WSL2 (Ubuntu), not PowerShell. Every command for the rest of the week runs in the WSL2 terminal.
 Keep your project files inside the Linux filesystem (e.g. ~/projects/), NOT on /mnt/c/.... Building Rust on the Windows-mounted drive is slow and causes weird file-permission failures. This is the #1 WSL2 gotcha. (concept: WSL2's Linux filesystem is fast; the Windows mount is a bridge and slow for compilers.)
 Update the box: sudo apt update && sudo apt upgrade -y.
 Install build prerequisites: sudo apt install -y build-essential pkg-config libssl-dev curl git. (concept: Rust needs a C linker and SSL headers to build native deps; missing these is the #2 Linux failure.)

Hour 1–2 · Rust — DONE

 Install Rust via rustup (the official installer one-liner from rust-lang.org). Choose the default install.
 Restart the shell or source the env so cargo and rustc are on PATH. Verify both print versions.
 Add the WASM target: rustup target add wasm32v1-none.

concept: a Soroban contract isn't a normal program — it compiles to WASM (a tiny portable bytecode the blockchain can run). Without this target, cargo build for the contract silently can't produce the right artifact.



Hour 2–3 · Stellar CLI — DONE

- DONE: Install the Stellar CLI (the tool that builds, deploys, and calls contracts). Verify it prints a version.
- DONE: Configure it for testnet and generate an identity (a keypair the CLI will use to sign deploys).
- DONE: Fund that identity from Friendbot (free fake testnet XLM).
- DONE: Open stellar.expert testnet explorer, paste your address, confirm the balance is there. You must SEE it on the explorer — this proves your CLI is really talking to testnet.


Checkpoint: if by hour 3 you cannot see your funded account on stellar.expert, do not push forward. Pull in P2 now. This is exactly the kind of thing the buddy rule exists for.

Hour 3–5 · Hello-world, unchanged — DONE

- DONE: Initialize the official hello-world Soroban contract (the CLI has a contract init that scaffolds it). Do not modify the logic.
- DONE: Read the generated files slowly. Identify these four things and say them out loud:

the #![no_std] line at the top (concept: the contract can't use Rust's standard library — there's a hard size limit on the compiled WASM, so you ship a minimal binary).
the #[contract] struct (concept: this is "the contract object").
the #[contractimpl] block (concept: the public functions inside here are what the outside world can call).
the function signature taking env: Env (concept: Env is the contract's window into the blockchain — storage, time, the caller's identity. You'll use it constantly.)


- DONE: Build it to WASM (release, wasm target).
- DONE: Deploy it to testnet with the CLI. Save the returned contract ID.
- DONE: Invoke its function from the CLI. See the return value in your terminal.
- DONE: Find the contract on stellar.expert by its ID. Screenshot it. This screenshot is your Day 1 trophy.

Hour 5–6 · Buffer / catch-up — DONE

- DONE: If everything worked: stop. Rest. Do NOT start writing your real contract today — a tired first attempt at the split logic creates bugs you'll fight on Day 2. Discipline is part of the job.
 If something's broken: this hour is why it exists. Use it. Bring in P2.

🟥 End-of-Day-1 ALL-4 gate — DONE

- DONE: You demo: live hello-world on testnet + the explorer screenshot.
 Be brutally honest here. If you're not deployed, say it plainly: "I need tomorrow morning to finish Day 1." That sentence today saves the whole team on Day 6. P4 runs this meeting; your job is to tell the truth into it.

"You are behind" recovery (Day 1)
If end of Day 1 you're stuck on toolchain: that's recoverable and common. Tomorrow morning is yours to finish it; the team absorbs the slip now while it's cheap. What is NOT acceptable is hiding it and "catching up later" — the contract is the critical path; a hidden 1-day slip here becomes a 3-day disaster.