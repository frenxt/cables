# Replicate Skill Stack (Local + Marketplace)

Use this skill to inventory, classify, and replicate your Claude skill stack across profiles.

## Taxonomy (renamed)

- Developer Workflow Systems (renamed from "developer experience")
- Reasoning Frameworks (renamed from "thought process")
- Domain Playbooks (renamed from "specific skills")

## Step 1: Inventory local profile skills

```bash
for d in ~/.claude ~/.claude-curious ~/.claude-frenxt ~/.claude-interviewlm ~/.claude-juliet; do
  echo "== $d =="
  ls -1 "$d/skills" 2>/dev/null || echo "(no skills dir)"
done
```

## Step 2: Inventory plugin-provided skills

```bash
node <<'NODE'
const fs=require('fs');
const path=require('path');
const homes=['.claude','.claude-curious','.claude-frenxt','.claude-interviewlm','.claude-juliet'];
const base=process.env.HOME;
const map=new Map();
for(const h of homes){
  const p=path.join(base,h,'plugins','installed_plugins.json');
  if(!fs.existsSync(p)) continue;
  const json=JSON.parse(fs.readFileSync(p,'utf8'));
  for(const [plugin,installs] of Object.entries(json.plugins||{})){
    for(const inst of installs){
      const root=inst.installPath;
      if(!root || !fs.existsSync(root)) continue;
      const found=[];
      const walk=(dir)=>{
        for(const e of fs.readdirSync(dir,{withFileTypes:true})){
          const fp=path.join(dir,e.name);
          if(e.isDirectory()) walk(fp);
          else if(e.isFile() && e.name==='SKILL.md'){
            const rel=path.relative(root,path.dirname(fp)).split(path.sep);
            const i=rel.lastIndexOf('skills');
            if(i>=0 && rel[i+1]) found.push(rel[i+1]);
          }
        }
      };
      walk(root);
      if(!map.has(plugin)) map.set(plugin,new Set());
      for(const s of found) map.get(plugin).add(s);
    }
  }
}
for(const [plugin,skills] of [...map.entries()].sort((a,b)=>b[1].size-a[1].size)){
  console.log(`${plugin}: ${skills.size}`);
}
NODE
```

## Step 3: Classify each skill into one bucket

Use this rubric:

- Developer Workflow Systems
  - Branch/release/CI/CD, QA orchestration, benchmark operations, environment setup
- Reasoning Frameworks
  - Diagnostic methods, decision loops, verification protocols, planning heuristics
- Domain Playbooks
  - Product/domain specific packs (marketing, observability, hosting platforms, analytics)

## Step 4: Build a replication matrix

Output a table with columns:

- `skill_name`
- `source` (`local` or `plugin:<name>`)
- `bucket`
- `adopt_in_profiles` (list of `~/.claude*` targets)
- `status` (`keep`, `pilot`, `archive`)

## Step 5: Apply replication intentionally

- Replicate all Developer Workflow Systems across active profiles.
- Replicate only high-signal Reasoning Frameworks.
- Add Domain Playbooks only where the project domain matches.

## Why this pattern works

This separates baseline execution behavior from specialized domain capability. Your agent stays consistent across repos while still gaining targeted expertise when needed.
