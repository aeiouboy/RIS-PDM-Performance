# RIS-PDM Dashboard - Project Context

## Azure DevOps Integration

### Project Details
- **Project Name**: Product - OMNIA
- **Project ID**: `5a84d15e-8501-445a-8e16-61f61dde7fb2`
- **Organization**: centralgroup
- **Team ID**: `ebc0b944-4d4c-4e56-9a4b-0cba64ec1954`

### Sprint Iterations
| Sprint | Phase | Iteration ID |
|--------|-------|--------------|
| MVP Sprint 1 | MVP | `d2e33333-fd33-42cd-8f80-939771747fed` |
| MVP Sprint 2 | MVP | `95b82ae4-b6c9-4e1b-84bd-d38c1484d1c1` |
| MVP Sprint 3 | MVP | `34926c20-b113-4d6a-8520-1179c2ddcbe5` |
| MVP Sprint 4 | MVP | `cb23e945-023d-4587-8a25-cbca9801ed03` |
| MVP Sprint 5 | MVP | `6c7ff3cb-26df-464b-9625-cb9b65dc5a6c` |
| MVP Sprint 6 | MVP | `5dc3f184-285c-433f-be1a-0c5bf5a687f3` |
| OMS Sprint 1 | OMS | `73c47169-5482-41cf-a805-e94d8ad4e26f` |
| OMS Sprint 2 | OMS | `e7a24821-d551-449e-a9a0-021055953d0e` |
| OMS Sprint 3 | OMS | `03f311f8-1df3-469c-af86-9966432b16d9` |

### Team Members (18 total)
| Name | Email | Role | Completion Rate |
|------|-------|------|-----------------|
| Patinya Kaewsrithong | kapatinya@central.co.th | Backend Lead | 88% |
| Sarayoot Sanboonreung | sasarayoot@central.co.th | Full Stack Lead | 73% |
| Phantharanun Thongasa | thphantharanun@central.co.th | Solution Architect | 78% |
| Pitthawat Wajeethongrattanaa | wapitthawat@central.co.th | Backend Dev | 100% |
| Thanapat Waewsri | wathanapat@central.co.th | Solution Architect | 46% |
| Natajrak Phuphatsirikorn | phnatajrak@central.co.th | Backend Dev | 88% |
| Naruechon Woraphatphawan | wonaruechon@central.co.th | Product Owner | 85% |
| Punnapa Thianchai | thpunnapa@central.co.th | Product Owner | 100% |
| Kanate Boonsiri | bokanate@central.co.th | Frontend Dev | 100% |
| Tawatchai Insree | intawatchai@central.co.th | Backend Dev | 50% |
| Thanapoom Sae-Tiew | sathanapoom@central.co.th | Backend Dev | 17% |
| Chongrak Tanaka | tachongrak@central.co.th | Frontend Dev | 100% |
| Thossaporn Sukprasomjit | suthossaporn@central.co.th | Backend Dev | 0% |
| Supasek Prajaksuvitee | prsupasek@central.co.th | Tech Lead | 50% |
| Teerapat Klongklaew | klteerapat@central.co.th | Solution Architect | 0% |
| Wisit Anusitwiwat | anwisit@central.co.th | Backend Dev | 0% |
| Siriya Hacha | hasiriya@central.co.th | QA | 100% |
| Tonnakorn Tiensermpong | titonnakorn@central.co.th | QA | 0% |

### Key Reports Location
- `docs/sprint-planning/OMS_Sprint_Velocity_Report.csv` - Full velocity report (12 sheets)
- `docs/sprint-planning/Sprint_Velocity_Data.csv` - Clean data for charts
- `docs/sprint-planning/Full_WorkItems_By_Assignee.csv` - Work items by assignee
- `docs/sprint-planning/Team_Workload.csv` - Team workload distribution

### Sprint Health (OMS Sprint 3)
- Completion Rate: 26%
- Blockers: 4 (Critical)
- Unassigned Items: 36 (49%)
- Health Score: 1.55/5 (CRITICAL)

---

## Revolutionary Approach: Direct Process Execution

### Overview
Instead of using tmux send-keys to interact with Codex CLI, use direct process execution with `codex exec` for cleaner, faster, and more reliable automation.

### Basic Usage
```bash
# Direct execution with custom settings
codex exec -s danger-full-access -c model_reasoning_effort="low" "Your task here"
# Examples
codex exec -s danger-full-access -c model_reasoning_effort="high" "Refactor the API to use TypeScript interfaces"
codex exec -s danger-full-access -c model_reasoning_effort="low" "List all files in src/"
```

### Helper Script Usage
A helper script `codex-exec.sh` simplifies common operations:
```bash
# Usage: ./codex-exec.sh [reasoning_level] "task"
./codex-exec.sh low "Quick file listing"
./codex-exec.sh high "Complex refactoring task"
./codex-exec.sh "Default task" # defaults to low reasoning
```

### Background Execution with Monitoring
For long-running tasks, use background execution:
```bash
# In Claude, use run_in_background parameter:
# Bash tool with run_in_background: true
# Then monitor with BashOutput tool using the returned bash_id
```

### Parallel Execution
Multiple Codex instances can run simultaneously:
```bash
# Start multiple background tasks
codex exec -s danger-full-access "Task 1" &
codex exec -s danger-full-access "Task 2" &
wait # Wait for all to complete
```

### Key Advantages Over TMux Approach
1. **No timing issues** - No sleep/wait commands needed
2. **Clean output** - Direct JSON/text without UI elements
3. **Exit codes** - Proper error handling with return codes
4. **Parallel execution** - Run multiple instances simultaneously
5. **Scriptable** - Easy integration with CI/CD pipelines

### Reasoning Levels
- `minimal` - Fastest, limited reasoning (~5-10s for simple tasks)
- `low` - Balanced speed with some reasoning (~10-15s)
- `medium` - Default, solid reasoning (~15-25s)
- `high` - Maximum reasoning depth (~30-60s+)

### Safety Considerations
- Using `danger-full-access` grants full system access
- Auto-approval with `--ask-for-approval never` bypasses confirmations
- Consider permission models for production use

### Common Patterns
```bash
# Add new API endpoint
codex exec -s danger-full-access -c model_reasoning_effort="high" \
  "Add a new REST endpoint /api/users that returns user data"
# Refactor code
codex exec -s danger-full-access -c model_reasoning_effort="high" \
  "Refactor the authentication module to use JWT tokens"
# Generate tests
codex exec -s danger-full-access -c model_reasoning_effort="medium" \
  "Write unit tests for the user service module"
# Quick fixes
codex exec -s danger-full-access -c model_reasoning_effort="low" \
  "Fix the typo in README.md"
```

### Integration with Claude
When Claude needs to use Codex:
1. Use direct `codex exec` commands instead of tmux
2. For long tasks, use `run_in_background: true`
3. Monitor progress with `BashOutput` tool
4. Check exit codes for success/failure
5. Parse clean output without UI filtering

### Discovered Capabilities
- Non-interactive execution with `codex exec`
- Parallel task execution
- Background monitoring
- Custom reasoning levels
- Direct file modifications
- Automatic git patches
- TypeScript/JavaScript understanding
- API endpoint creation
- Code refactoring
