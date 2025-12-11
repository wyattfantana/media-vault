# MediaVault Slash Commands

Custom slash commands for working with MediaVault project.

## TODO Management Commands

### `/todo`
Show the complete TODO.md file with all sections, history, and planning info.

**Use when:** You want to see the full TODO roadmap and documentation.

---

### `/todo-status`
Quick project status overview - what's working, what's broken, current session.

**Use when:** You want a quick health check of the project without scrolling through everything.

---

### `/todo-next`
Show high priority tasks and what to work on next.

**Use when:** Starting a new work session and need to know where to begin.

---

### `/todo-bugs`
Show all critical bugs and issues that need fixing.

**Use when:** You want to focus on bug fixes and see what's broken.

---

### `/todo-ux`
Show UX enhancement ideas and top 5 recommendations.

**Use when:** Planning UI/UX improvements.

---

### `/update-todo`
Interactive command to update the TODO.md file with progress, completed tasks, or new entries.

**Use when:** You've made progress and want to update the TODO tracker.

---

### `/todo-session`
Start a new work session entry in the TODO tracker.

**Use when:** Beginning a new coding session and want to document what you're working on.

---

## How to Use

Simply type the command in your chat with Claude:

```
/todo-status
```

Claude will execute the command and show you the relevant information.

## Creating New Commands

To create a new command:

1. Create a new `.md` file in `.claude/commands/`
2. Add frontmatter with description:
   ```markdown
   ---
   description: What this command does
   ---

   Your command prompt here
   ```
3. The filename becomes the command (e.g., `my-command.md` → `/my-command`)
