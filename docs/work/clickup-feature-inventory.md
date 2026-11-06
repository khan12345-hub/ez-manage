# ClickUp Feature Inventory — build checklist for EZ Manage "Work"

Compiled 2026-11-06 from public sources only (no login):
- ClickUp Help Center (help.clickup.com). Browser-style fetch returned 403, so the article bodies were read via the Help Center's public, unauthenticated article API (`help.clickup.com/api/v2/help_center/en-us/articles.json`, 1,190 articles).
- clickup.com/features (the feature catalog with per-category counts)
- developer.clickup.com (API docs: Custom Field value formats, webhooks)

Phase tags: **[P2]** core · **[P3]** depth · **[P4]** AI · **[P6]** integrations/imports.
Where a ClickUp behavior is plan-gated, that is noted as "(paid)" or "(Business+)", but only as context. We probably don't need to copy their gating.
`(?)` = uncertain, or inferred from secondary text rather than read in a source article.

---

## 1. Hierarchy & navigation
Sources: https://help.clickup.com/hc/en-us/articles/6304327753111-Intro-to-ClickApps · https://help.clickup.com/hc/en-us/articles/6308862167575-Favorites · https://clickup.com/features

- [ ] Workspace — top-level tenant. It owns people, settings, ClickApps, task types, Custom Fields and templates. [P2]
- [ ] Spaces — department or team containers with their own name, icon/color, privacy, statuses, ClickApps and default views. [P2]
- [ ] Space privacy — Public (all members get full edit by default) or Private (only invited people). A setting can make new Spaces private by default. [P2]
- [ ] Space sharing — invite people and Teams (user groups) to a Space with a permission level. [P2]
- [ ] Per-Space ClickApps — turn features on per Space: Custom Fields, Email, Dependency Warning, Incomplete Warning, Multiple Assignees, Priority, Remap Subtask Due Dates, Reschedule Dependencies, Show status progress, Tags, Time Estimates, Time Tracking, Sprints, Sprint Points, WIP Limits. [P2]
- [ ] Spaces Home / Overview — landing page for a Space with cards (recent items, Docs, resources, etc.). [P3]
- [ ] Folders — optional grouping of Lists inside a Space. Can override statuses. Has a color. [P2]
- [ ] Subfolders — a Folder nested inside a Folder. Statuses inherit from the parent Folder, or from the Space if the Folder has no custom statuses. [P3]
- [ ] Lists — the containers that hold tasks. They can sit in a Folder or directly in a Space ("folderless" List). [P2]
- [ ] List Info — List description, List owner, List priority, List color, and start/due dates on the List. [P2]
- [ ] Tasks — work items that live in a "home" List. [P2]
- [ ] Subtasks — child tasks with all task fields. They use the parent List's statuses. [P2]
- [ ] Nested subtasks — up to 7 levels deep. The max depth is configurable via ClickApp. [P2]
- [ ] Subtask limits — about 1,000 subtasks per task (features page). Recurrence stops working at 500 or more subtasks, nested included. [P2]
- [ ] Checklists — up to 250 checklists per task and 500 items per checklist. Items nest up to 5 levels, can be assigned to one person, reordered by drag between checklists, and created by pasting a list. [P2]
- [ ] Checklist actions — rename, assign all, unassign all, check all, uncheck all, save as template, delete, and convert items to subtasks. [P2]
- [ ] Tasks in Multiple Lists — a task can also show in other Lists while keeping its home List's statuses. Recurrence happens only in the home List. [P3]
- [ ] Subtasks in Multiple Lists — a subtask can be added to other Lists independently of its parent. [P3]
- [ ] Everything view — workspace-wide views across all Spaces. It shows only statuses common to all levels. Public Everything views can be shared. [P2]
- [ ] Archive / restore — archive tasks, Lists, Folders, Subfolders, Spaces, Docs and pages. Archived items are hidden and can be restored. Tasks in archived locations don't recur. [P2]
- [ ] Delete and Trash — deleted items can be restored for a period (?). Deleting requires the "Delete Items" permission. [P2]
- [ ] Favorites — personal starred items: Spaces, Folders, Lists, tasks, Channels, DMs, Docs, Dashboards, Whiteboards, Forms, views and Sprints. Favorites can be pinned to the top or bottom and given an alias. [P2]
- [ ] Custom sidebar sections — users create their own sidebar groupings. [P3]
- [ ] Home Sidebar / Spaces Sidebar — tree navigation with search, filter, and create from the sidebar. [P2]
- [ ] Move items — move tasks between Lists (prompts to remap conflicting statuses). Move Folders, Lists and Docs between locations. Reorder and hide Spaces. [P2]
- [ ] Duplicate — duplicate tasks, Spaces, Folders, Subfolders, Lists and views, choosing what to include. [P2]
- [ ] Merge tasks — merge task A into B. B keeps its own fields. A's description is appended, and A's assignees, comments, attachments and subtasks move to B. A's Custom Field values copy only into B's empty fields. A's activity and ID are dropped. This cannot be undone. [P3]
- [ ] Convert task to List. [P3]
- [ ] Location picker — a shared component for choosing a Space, Folder or List when creating or moving items. [P2]
- [ ] Tray — minimize open tasks and Docs to a tray for quick switching. [P3]
- [ ] Personal List — a private to-do List outside the shared hierarchy, with its own columns and statuses. [P3]

## 2. Statuses
Sources: https://help.clickup.com/hc/en-us/articles/6309452618647-Manage-task-statuses · https://help.clickup.com/hc/en-us/articles/6309517280919-Use-Done-statuses · https://help.clickup.com/hc/en-us/articles/6309432702103-Not-Started-Statuses · https://help.clickup.com/hc/en-us/articles/6309533958935-Status-templates · https://help.clickup.com/hc/en-us/articles/6308803927831-Task-statuses-for-Folders-and-Subfolders · https://help.clickup.com/hc/en-us/articles/6309465975063-Statuses-FAQ

- [ ] Custom statuses — name, color and order, defined at the Space, Folder, Subfolder or List level. [P2]
- [ ] Status groups — Not Started (optional, ClickApp), Active, Done and Closed. Every status belongs to one group. [P2]
- [ ] Default statuses — "To Do" (start) and "Complete" (the only Closed status). The Closed status can be renamed, but custom Closed statuses can't be added. [P2]
- [ ] Not Started group — Not Started statuses always appear as groups or columns, even when empty, so tasks can be created at the start of a workflow. [P2]
- [ ] Done semantics — Done tasks stay visible. They are never overdue (no start/due notifications), unblock dependents, and count as complete in Goals, Portfolios and Home. [P2]
- [ ] Closed semantics — Closed tasks are hidden by default in List view. A "Show closed" toggle reveals them, optionally including subtasks. [P2]
- [ ] Status inheritance — Space → Folder → Subfolder → List. Each level can inherit or use custom statuses. [P2]
- [ ] Status remap on move — moving a task, or applying a template, to a location with different statuses opens a mapping dialog. [P2]
- [ ] Status templates — save a status set as a named template and apply it to any location. Editing a template in one place detaches the other locations, which become "Custom". [P3]
- [ ] Mixed-status boards — a Board at the Folder or Space level shows the union of its Lists' statuses. [P2]
- [ ] Status colors persist — a moved task keeps its status color from its origin (documented quirk). [P2]
- [ ] Status icon — shows a checkmark when a location has 2 statuses and a square when it has more. [P2]
- [ ] Show status progress ClickApp — pie-chart icon showing position in the workflow. [P3]
- [ ] Reverse status order in grouped views. [P3]
- [ ] Work In Progress limits — soft per-status limits on Board columns with visual warnings. [P3]
- [ ] Total Time in Status — tracks time a task spent in each status. Shown on the task, in a column and on Dashboard cards. [P3]
- [ ] Status edit permissions — owners and admins by default. Advanced permissions "Edit Statuses" and "Delete Items" control others. [P2]
- [ ] Practical limit — no hard cap. Fewer than 100 statuses per location is recommended. [P2]

## 3. Task fields & task detail
Sources: https://help.clickup.com/hc/en-us/articles/6304528030743-Intro-to-Relationships · https://help.clickup.com/hc/en-us/articles/6309155073303-Intro-to-Dependency-Relationships · https://help.clickup.com/hc/en-us/articles/6309885016471-Use-recurring-tasks · https://help.clickup.com/hc/en-us/articles/17564381376919-Custom-task-types · https://clickup.com/features

- [ ] Task name — supports in-place edit and bulk rename. [P2]
- [ ] Description — rich text with headings, lists, checklists, tables, code blocks, embeds, mentions and /slash commands. Shares the Docs editor. [P2]
- [ ] Synced content blocks — a block authored once (Doc or description). Its copies update when the original changes. [P3]
- [ ] Assignees — one assignee by default, or many when the Multiple Assignees ClickApp is on. Teams can be assigned. [P2]
- [ ] Followers (watchers) — receive notifications. Auto-added when you create, are assigned or comment (?). Can be added or removed manually. [P2]
- [ ] Priority — Urgent, High, Normal, Low or none. Toggled by ClickApp per Space. [P2]
- [ ] Start date and due date — both optionally with time. Natural-language entry. Relative-date display option. [P2]
- [ ] Duration ClickApp — keeps the task length fixed when dates move. [P3]
- [ ] Skip Non-Working Days — dates shift off non-working days based on work schedules. [P3]
- [ ] Time estimate — per task, or per assignee (Business+). Rolls up from subtasks. [P2]
- [ ] Tags — Space-level colored tags. Add or remove on tasks. Creating or editing tags is permission-controlled. [P2]
- [ ] Custom task types — Workspace-defined types (e.g. Bug, Invoice) with an icon and singular/plural names. Lists can set a default type. Can be set in bulk, filtered and grouped. [P3]
- [ ] Milestones — a task type shown as a diamond in Gantt and Timeline. [P3]
- [ ] Task IDs — every task has a unique ID used for search and links. [P2]
- [ ] Custom Task IDs — a per-Space prefix plus a sequence (e.g. ENG-123), searchable. [P3]
- [ ] Attachments — upload files or cloud links. Preview images, video, PDF and Office files (ClickApp). Private attachment links. [P2]
- [ ] Cover image — set an attachment as the task cover, shown on Board cards. Can be pinned. [P3]
- [ ] Sprint Points — numeric effort per task, or per assignee (Business+). Rolls up. [P3]
- [ ] Relationships — URL, task-to-task, Doc and Custom relationships. Up to 300 linked tasks per task. [P3]
- [ ] Reference relationships — created automatically when a task or Doc is @mentioned anywhere. [P3]
- [ ] Dependencies — "blocks" and "waiting on" (blocked by). Created from the task, views (Gantt drag) or Automations. [P3]
- [ ] Dependency types in Gantt — FS/SS/FF/SF style linking (?) and enforcement settings ("Dependency enforcement" and "Dependency types" are listed features). [P3]
- [ ] Dependency Warning — warns when closing a task that is waiting on open tasks. [P3]
- [ ] Reschedule Dependencies — moving a blocking task shifts the dates of its waiting tasks by the same delta. [P3]
- [ ] Dependency notifications — when a dependency is added or removed, and when a task becomes unblocked. [P3]
- [ ] Incomplete Warning — warns before closing a task with unresolved subtasks, checklists or assigned comments. [P3]
- [ ] Remap Subtask Due Dates — shifting a parent's due date shifts its subtasks. [P3]
- [ ] Sync parent and subtask dates. [P3]
- [ ] Recurring tasks: schedule — Daily (skip weekends), Weekly, Monthly (same day, first day, last day, or Nth weekday), Yearly, N days after completion, or Custom. [P3]
- [ ] Recurring tasks: trigger — "when complete" (Closed), "when done" (Done or Closed) or "on schedule". Default time is 11pm in the setter's timezone. Closing early recurs immediately. [P3]
- [ ] Recurring tasks: options — create a new task or reuse the same one, recur forever, repeat N times or end on a date, set the status for the new instance, and choose which fields carry over (description, Custom Fields, checklists, subtasks, assignees, tags, dependencies, relationships, attachments, comments, etc.). [P3]
- [ ] Recurring Task Overview — a Workspace list of all recurring tasks. [P3]
- [ ] Future recurring instances on Calendar (paid). [P3]
- [ ] Task templates — save a task (including subtasks and checklists) as a template. Apply on create or to existing tasks. A List can set a default task template. Templates can be pinned in List view. [P3]
- [ ] Private tasks — a task can be made private within a shared List. [P3]
- [ ] Email into a List or task — each List or task has an email address that creates tasks or comments. [P6]
- [ ] Task view layout — main panel (fields, description, subtasks, checklists, relationships, attachments) plus an Activity/comments side panel. Task layouts are configurable, and there is a right sidebar. [P2]
- [ ] Task activity log — history of every change. Searchable and filterable. [P2]
- [ ] Quick create modal — create a task, Doc, reminder, Whiteboard, etc. from anywhere, with a location picker and type switcher. [P2]
- [ ] Bulk Action Toolbar — multi-select tasks to change status, assignees, dates, priority, tags, Custom Fields or type, and to move, copy, merge, archive or delete them. [P2]
- [ ] Public task view — share a task via public link. [P3]
- [ ] Print tasks. [P3]
- [ ] Standard read-only fields — Created by, Date created, Date updated, Date closed, Date done. [P2]
- [ ] Task "Remind me in Inbox" — set a personal reminder on a task. [P2]

## 4. Custom Fields
Sources: https://help.clickup.com/hc/en-us/articles/6303499162647-Custom-Field-types · https://developer.clickup.com/docs/customfields · https://clickup.com/features

Field types:
- [ ] Text — single line. 2,048 character limit. [P3]
- [ ] Text area (Long Text) — rich text. 50,000 character limit. [P3]
- [ ] Number — formatted numeric value. [P3]
- [ ] Money — amount plus a currency chosen per field. [P3]
- [ ] Dropdown — single select. Up to 500 options with colors and sort order (auto or manual). Bulk-paste options. Options are global across all of the field's locations. [P3]
- [ ] Labels — multi-select tag-like options. Up to 500 options with colors. [P3]
- [ ] Checkbox — true or false. [P3]
- [ ] Date — date with optional time. [P3]
- [ ] Email — validated email address. [P3]
- [ ] Phone — country code plus number. [P3]
- [ ] Website (URL). [P3]
- [ ] People — users and/or Teams. Options control single vs multiple selection, whole Workspace vs task-access people, showing guests, and including Teams. [P3]
- [ ] Files — attachments stored in a field. [P3]
- [ ] Location — Google Maps-formatted address with lat/lng. Powers Map view. [P3]
- [ ] Rating — emoji scale from 1 to 5. [P3]
- [ ] Progress (Auto) — computed from subtasks, archived subtasks, checklists and assigned comments. Configurable behavior for tasks with no items. Nested subtasks are not included. [P3]
- [ ] Progress (Manual) — start/end values, displayed as a percentage. [P3]
- [ ] Formula — arithmetic, date, logic and string functions across fields, simple or advanced. [P3]
- [ ] Relationship (Tasks field) — links to tasks, from anywhere or from one specific List. [P3]
- [ ] Rollup / Relationship columns — show a related task's date created/updated/closed, start or due date, time tracked, time estimate, sprint points, status, or a Custom Field. [P3]
- [ ] Button — a click on the task triggers an Automation. [P3]
- [ ] Signature — typed or drawn signature. [P3]
- [ ] Voting — emoji votes, with an option to see or hide who voted. Not settable via API. [P3]
- [ ] AI Fields (on Text, Long Text and Dropdown) — Summary, Progress update, Translation, Action items, Sentiment, Categorize, T-shirt size, and custom autofill. [P4]

Field management:
- [ ] Field scopes — fields are added per location (Space, Folder or List, inherited downward) or per task type ("Custom Fields by task type"). [P3]
- [ ] Custom Field Manager — workspace-wide catalog to view, search, edit, move, merge, duplicate, convert type and delete fields. Shows where each field is used. [P3]
- [ ] Required fields — must be filled when a task is created (Business+). [P3]
- [ ] Default values per field. [P3]
- [ ] Field descriptions and tooltips (?). [P3]
- [ ] Pinned fields — always shown on the task, even when empty. [P3]
- [ ] Hide empty fields and show hidden fields on the task. [P3]
- [ ] Private fields and per-field permissions — restrict who can see or edit a field. Fields can be hidden from guests and limited members. [P3]
- [ ] Manual ordering of fields on the task. [P3]
- [ ] Filter, sort, group and calculate by Custom Field in views. [P3]

## 5. Views (task views + page views)
Sources: https://help.clickup.com/hc/en-us/articles/6329880717719-Intro-to-views · https://help.clickup.com/hc/en-us/articles/35368731425175-The-views-control-bar · https://help.clickup.com/hc/en-us/articles/6310202447511-Use-grouping-in-views · https://help.clickup.com/hc/en-us/articles/6308875427223-Use-filters-to-search-tasks · https://help.clickup.com/hc/en-us/articles/6308948062871-Intro-to-Me-Mode-and-the-assignee-sidebar · https://clickup.com/features

Task views:
- [ ] List view — grouped rows (by default by status), configurable columns, inline edit, inline subtask create and expand, drag reorder (manual sort), and per-group add task. [P2]
- [ ] Board view (Kanban) — columns by status, or by any groupable field. Drag between columns changes the field. Card fields and cover images are configurable. [P2]
- [ ] Board subgroups (swimlanes). [P3]
- [ ] Calendar view — day, week and month. Drag tasks to set dates, an unscheduled-tasks panel, colors by field, national holidays, and future recurring tasks. [P2]
- [ ] Gantt view — bars from start to due date, drag dependencies, progress, critical path and slack time, baselines, milestones, PDF export, and public Gantt. [P3]
- [ ] Table view — spreadsheet grid with equal row heights. No List/status separation by default. Copy/paste and export. [P3]
- [ ] Timeline view — horizontal schedule grouped by assignee or field (lanes). Shows personal time off. [P3]
- [ ] Workload view — capacity per person per period, measured by task count, time estimates, sprint points or a Custom Field. Capacity limits, grouping and drag-to-reassign. [P3]
- [ ] Team view (formerly Box) — per-person cards showing what each person is working on, has done, and has scheduled. [P3]
- [ ] Activity view — feed of all changes in a location. [P3]
- [ ] Map view — tasks plotted by Location field. [P3]
- [ ] Mind Map view — tasks/subtasks as a tree, or a free-form map. Create and edit tasks from nodes. [P3]
- [ ] Workload chart. [P3]
- [ ] Everything-level views. [P2]

Page views (non-task):
- [ ] Doc view — a Doc pinned as a view tab. [P3]
- [ ] Form view — form builder that creates tasks. [P3]
- [ ] Chat view — location-based chat channel. [P3]
- [ ] Whiteboard view. [P3]
- [ ] Dashboard view — a Dashboard as a view tab. [P3]
- [ ] Embed view — iframe any URL (Figma, Google Sheets, YouTube, etc.). [P3]
- [ ] Artifact view — an AI-generated visual page (one-pager or summary) as a view. [P4]
- [ ] Overview — location overview page with cards. [P3]

View settings & infrastructure:
- [ ] Views Bar — tabs per location. Add, pin, reorder, group, rename, duplicate, move and delete views. Custom view icons. [P2]
- [ ] Default views — each new location gets List and Board views. A default view can be set per location. [P2]
- [ ] Group by — status, assignee, priority, tags, due date, task type, or a Custom Field (dropdown, rating, checkbox, date, people, labels). Custom relationships are groupable in List view only. Groups collapse. [P2]
- [ ] "One value per group" — a multi-assignee or multi-tag task appears in each matching group (List view). [P3]
- [ ] Sort — by any field, multi-level, or manual drag order. [P2]
- [ ] Filters — field/operator/value rows with And/Or and nested filter groups. Includes relative dates (e.g. next week), dependency filters, and Custom Fields. [P2]
- [ ] Saved filters — reusable filter sets. [P3]
- [ ] Filtered fields on create — a new task inherits values from active filters (status, dropdown, priority, dates, checkbox, tag). [P2]
- [ ] AI-built filters — plain-language request becomes a filter. [P4]
- [ ] View search — searches task name, description, text Custom Fields and task IDs. Ctrl/Cmd+F focuses it. [P2]
- [ ] Show subtasks — collapsed, expanded, or as separate tasks. Separate tasks are required for filtering subtasks. [P2]
- [ ] Show closed tasks toggle. [P2]
- [ ] Columns — show or hide fields and Custom Fields, reorder, resize and pin columns. [P2]
- [ ] Column calculations — sum, average, min, max, count, etc. per group (List and Table views). [P3]
- [ ] Assignee sidebar — filter the view to any set of people or Teams, optionally including their assigned comments. [P2]
- [ ] Me Mode — show only my tasks, subtasks, assigned comments and checklist items. Applies per user across views. New tasks get auto-assigned to me. A view can default to Me Mode. [P2]
- [ ] Save view — changes are unsaved until saved for everyone. Autosave per user (?). [P2]
- [ ] Private views — visible only to their creator. The Default Private Views ClickApp makes all new views private. [P2]
- [ ] Shared and public views — a public link with optional authentication. Public variants exist for List, Board, Gantt, Table, Map, Mind Map, Timeline and Everything. [P3]
- [ ] Protected views — lock settings against edits. [P3]
- [ ] Required views — admins force a view to exist on locations. [P3]
- [ ] View templates — save a view's settings and reuse them. Default view templates exist. [P3]
- [ ] View permissions — "Create Views" permission. Members can always create personal views. [P3]
- [ ] Export views — List and Table views export to CSV/Excel. [P3]
- [ ] Print views. [P3]
- [ ] View caching — fast reload of large views. [P3]
- [ ] Wrap text and row density options (?). [P3]

## 6. Collaboration: comments, Inbox, Home, reminders, Clips, Chat, proofing
Sources: https://help.clickup.com/hc/en-us/articles/33947959867543-What-is-the-Inbox · https://help.clickup.com/hc/en-us/articles/34058632971543-Create-a-reminder · https://help.clickup.com/hc/en-us/articles/18944788880791-My-Tasks-page-formerly-Home · https://help.clickup.com/hc/en-us/articles/6325985679383-Annotate-images-videos-and-PDFs-with-Proofing · https://clickup.com/features

Comments:
- [ ] Task comments — rich text with attachments and @mentions of people, Teams, tasks and Docs. [P2]
- [ ] Threaded comments — replies to a comment (ClickApp). Replies do not trigger automations. [P2]
- [ ] Assigned comments — assign a comment to a person or Team as an action item. It is resolved by the assignee and counts in Progress and Incomplete Warning. [P2]
- [ ] Comment reactions — any emoji. [P2]
- [ ] Edit, delete and copy a link to a comment. [P2]
- [ ] Scheduled-send comments. [P3]
- [ ] Create a task or subtask from a comment. [P3]
- [ ] GIFs (GIPHY) and custom emojis. [P3]
- [ ] Note: ClickUp says "task comments now work like Chat" (an article exists). Comments are converging on the chat UI (?). [P3]

Inbox & notifications:
- [ ] Inbox — per-Workspace personal notification center with Primary, Other, Later and Cleared tabs, plus an optional All tab. Unread badge. [P2]
- [ ] Primary routing — comments and replies, assigned comments, tasks assigned to me, @mentions (including Teams), due reminders, reactions, items shared with me, and snoozed items now due. Configurable. [P2]
- [ ] Clear, snooze and save for later. Notifications are grouped per item. [P2]
- [ ] Retention — 3 months uncleared, 1 month cleared. [P2]
- [ ] Notification settings — per event type and per channel (in-app, email, mobile push, desktop). [P2]
- [ ] User status and mute notifications (do not disturb). [P3]

Home / My Work:
- [ ] My Tasks page (formerly Home) — a canvas of cards that can be added, reordered and removed. [P2]
- [ ] Cards — Recents, Agenda (tasks, reminders and calendar events), LineUp (top priorities), Assigned to me (by due date), Reminders, Assigned comments, My Work (legacy layout grouping: Today, Overdue, Next, Unscheduled), Personal List, and AI StandUp. [P2]
- [ ] Personal Priorities / LineUp — personal ordered "do next" list. [P2]
- [ ] Planner — drag tasks onto your calendar (time blocking) alongside external calendar events. [P3]

Reminders:
- [ ] Reminders — lightweight items with a name, due date and time, description, recurrence, attachment, notification schedule, and delegation to another person. They live in the Inbox (Later, then Primary when due). [P2]
- [ ] Delegated and recurring reminders. [P3]

Clips, Proofing, Chat, SyncUps:
- [ ] Clips — screen and voice recordings attached to tasks and comments or shared via public URL. Clips Hub. Transcription (AI) for voice clips. [P3]
- [ ] Proofing — pin comments on image (PNG/GIF/JPEG/WEBP), PDF and video attachments (timestamped). These become assigned comments that can be resolved. [P3]
- [ ] Chat Channels — standalone channels, or channels tied to a location that share its permissions. Public and private. [P3]
- [ ] Direct messages and group DMs. [P3]
- [ ] Threads, reactions, forwarding, save for later, drafts and sent, and scheduled messages. [P3]
- [ ] Posts — long-form channel posts (announcements, updates). [P3]
- [ ] FollowUps — assign a message to someone as a follow-up. [P3]
- [ ] Create or link tasks from chat messages. [P3]
- [ ] Chat Automations — triggers (message posted, schedule, webhook) and actions (send message, DM, webhook, launch agent). [P3]
- [ ] SyncUps — audio and video huddles from Chat with screen share, recordings, and links to tasks. [P3]
- [ ] Who's Online indicator. Pulse (who's working on what). [P3]

## 7. Docs & Wikis
Sources: https://help.clickup.com/hc/en-us/articles/6328174371351-Intro-to-Docs · https://clickup.com/features

- [ ] Docs — collaborative rich-text documents attached to a location or a Workspace (Docs Hub). [P3]
- [ ] Pages and subpages — nested, drag to reorder. Page icon and cover image. Search within a Doc. [P3]
- [ ] Wikis — a Doc marked as source of truth. Prioritized in search and AI. [P3]
- [ ] Rich editor — headings, lists, toggles, tables, columns, banners, code blocks, dividers, embeds, images, /slash commands, and Markdown shortcuts. [P3]
- [ ] Real-time co-editing with cursors. Inline comments and assigned comments in Docs. [P3]
- [ ] Mention and embed tasks and Docs. Live task embeds or lists. Create tasks from Doc text. [P3]
- [ ] Synced content blocks across Docs and descriptions. [P3]
- [ ] Doc relationships — link a Doc to tasks. [P3]
- [ ] Doc followers, Doc tags, and Doc settings (font, width, page-level options). [P3]
- [ ] Docs Hub — central list with search, filters, recent, favorites and created-by-me. [P3]
- [ ] Sharing — private Docs, per-person permissions, public link (optionally indexed by search engines), and protect Doc (lock editing). [P3]
- [ ] Doc templates and page templates. [P3]
- [ ] Export Doc (PDF, HTML, Markdown) and print. [P3]
- [ ] Archive and unarchive Docs and pages. Version history (?). [P3]
- [ ] Notepad — personal scratchpad with checklist items that convert to tasks. [P3]
- [ ] Import Docs from Confluence, Notion, etc. [P6]

## 8. Whiteboards
Source: https://help.clickup.com/hc/en-us/articles/6326615000471-Intro-to-Whiteboards

- [ ] Infinite canvas with real-time cursors. Shapes, sticky notes, connectors, text, pen, images and embeds. [P3]
- [ ] Add, create and edit tasks and Docs on the canvas. Convert a shape, sticky or text into a task. [P3]
- [ ] Whiteboards Hub, Whiteboard as a view, and templates. [P3]
- [ ] Sharing and permissions, including public links for people without accounts. [P3]

## 9. Goals / Targets
Source: https://help.clickup.com/hc/en-us/articles/6325733579671-Create-a-Goal

- [ ] Goals — objectives with an owner, due date, description, color and progress percentage. [P3]
- [ ] Targets — Number (range, up or down), True/False, Currency, and Task (a task, subtask or entire List, auto-completing). [P3]
- [ ] Goal progress — auto-calculated from Targets. Tasks show a Goal badge. [P3]
- [ ] Goal Folders — group goals, share Folders. [P3]
- [ ] Goal sharing and privacy permissions. [P3]
- [ ] Goals Dashboard cards. [P3]
- [ ] Note: the Help Center also has "use the hierarchy, Lists and Dashboards for OKRs" guides. Goals still exist, with 6 entries on the feature page. [P3]

## 10. Dashboards
Sources: https://clickup.com/features · Help Center "Intro to cards", "Calculation cards", etc.

- [ ] Dashboards — grid canvas of cards. Move and resize cards. Dashboard-level filters, including mixed filters. Auto-refresh. [P3]
- [ ] Sharing — private, shared, public link, Dashboard as a view, and scheduled report emails (?). [P3]
- [ ] Drill-down from a card to the underlying tasks. Export card data (CSV). [P3]
- [ ] Card types: custom charts — Bar, Line, Pie, Battery, Calculation (sum, avg, etc.), Portfolio (progress of Lists or Folders), and Table. [P3]
- [ ] Card types: task cards — Task List, Assignee (tasks by assignee, assigned/unassigned), Priority (breakdown, over time, totals), Status (status over time, tasks in progress/closed/completed, time in status, workload by status), and Tag (usage, usage over time). [P3]
- [ ] Card types: sprint and agile — Sprint Burndown, Burnup, Velocity, Sprint Task Report, Cumulative Flow, Cycle Time and Lead Time. Legacy versions also exist. [P3]
- [ ] Card types: time — Timesheet, Time reporting, Billable report, Time tracked and Time estimated (legacy). [P3]
- [ ] Card types: people — Who's Behind, Worked On, Workspace Points, and Activity view card. [P3]
- [ ] Card types: content — Notes (rich text), Bookmarks, Discussion (chat), Goals, and Embed (Figma, Google Docs/Sheets/Slides, YouTube, Typeform, InVision, etc.). [P3]
- [ ] AI cards — AI summary or StandUp cards (?). [P4]

## 11. Time tracking
Sources: https://help.clickup.com/hc/en-us/articles/6304291811479-Intro-to-time-tracking · https://help.clickup.com/hc/en-us/articles/27090646766231-Timesheet-approvals

- [ ] Global timer — start/stop a timer on a task from anywhere. One timer runs at a time. [P3]
- [ ] Manual time entries — duration or a start–end range. Edit and delete entries. [P3]
- [ ] Entry notes (descriptions), entry labels (tags), and billable flag. A Workspace setting sets the billable default. [P3]
- [ ] Track time without a task. [P3]
- [ ] Time tracked column and rollup from subtasks (Time Tracking Rollup). [P3]
- [ ] Time estimates versus tracked comparison. Estimates per assignee. [P3]
- [ ] Timesheets Hub — weekly grid per person to log time and submit. [P3]
- [ ] Timesheet approvals — weekly deadline, reminders, submitters and approvers. Tabs: To review, Changes requested, Approved and All. [P3]
- [ ] Time reporting, billable and timesheet Dashboard cards. Export time data. [P3]
- [ ] Guest time-tracking visibility permissions. [P3]
- [ ] Personal time off — shown in Timesheets, Workload, Gantt and Timeline. Work schedules and national holidays. [P3]
- [ ] Third-party time trackers (Harvest, Toggl, Clockify, Everhour, Hubstaff, TimeCamp, etc.). [P6]

## 12. Sprints (agile)
Sources: https://help.clickup.com/hc/en-us/articles/6303974210071-Intro-to-Sprints · https://help.clickup.com/hc/en-us/articles/35755228382359-Customize-sprint-settings-for-each-sprint

- [ ] Sprints ClickApp — enable per Space. [P3]
- [ ] Sprint Folders and Sprint Subfolders — special Folders whose Lists are sprints. Default settings are inherited per Workspace and Folder. [P3]
- [ ] Sprint settings — name pattern with {INDEX}, List template, start date and duration (custom durations optional, editable only before start), and Sprint Goal text. [P3]
- [ ] Auto-start and auto-complete sprints. Spillover moves unfinished tasks to the next sprint. [P3]
- [ ] Backlog — add tasks to a sprint from the backlog. Plan future sprints. [P3]
- [ ] Sprint Points (and per assignee). Sprints column in views. Sprint header with progress. [P3]
- [ ] Sprint statuses (not started, in progress, done). [P3]
- [ ] Epics. [P3]
- [ ] Sprint Automations and sprint report cards. [P3]

## 13. Automations
Sources: https://help.clickup.com/hc/en-us/articles/6312128853015-Use-Automation-Triggers · https://help.clickup.com/hc/en-us/articles/6312097314199-Use-Automation-Actions · https://help.clickup.com/hc/en-us/articles/6312136485527-Use-Automation-Conditions

General:
- [ ] Automation model — scoped to a Space, Folder, Subfolder or List. Applies to tasks, subtasks, or both. Trigger, then optional Conditions, then ordered Actions (drag to reorder). Multiple actions per automation. [P3]
- [ ] Automations Manager — list, enable/disable, edit, and see the activity log (runs and failures). [P3]
- [ ] Prebuilt templates library plus a custom builder. [P3]
- [ ] Dynamic variables in actions — task ID, name, dates, Custom Fields, "triggered by", creator, followers, etc. [P3]
- [ ] Automation usage quotas per plan (context only). [P3]

Triggers:
- [ ] Task or subtask created (with a filter for creation source). [P3]
- [ ] Status changes (from/to). [P3]
- [ ] Assignee added and Assignee removed. [P3]
- [ ] Priority changes (from/to). [P3]
- [ ] Custom Field changes (from/to, new vs existing tasks). [P3]
- [ ] Task or subtask name changes. [P3]
- [ ] Comment is added (threaded replies excluded). [P3]
- [ ] Checklists resolved and Subtasks resolved. [P3]
- [ ] Due date arrives, Due date changes, Start date arrives, Start date changes, and Date is before/after (N days before or after a date, fires at 4am local time). [P3]
- [ ] Every… (scheduled recurrence over all open tasks in the List). [P3]
- [ ] Existing task added to this location, and Moved to this List. [P3]
- [ ] Tags added and Tags removed. [P3]
- [ ] Task linked, and Task unblocked. [P3]
- [ ] Time tracked (by a user). [P3]
- [ ] Task type changes. [P3]
- [ ] Webhook received (inbound POST URL). [P3]
- [ ] Button Custom Field clicked (manual trigger). [P3]
- [ ] Integration triggers — GitHub, Google Calendar, HubSpot, Calendly, Gmail, Outlook, Twilio, Bugsnag, etc. [P6]

Conditions:
- [ ] Assignee, Follower, Priority, Status, Tag (any, all, or none), Task type, Start date, Due date, and Current date is (before/after a fixed or relative date). [P3]
- [ ] Custom Field — equals, not equals, set, not set. Regex on text and email fields. [P3]
- [ ] Task name — contains, does not contain, equals, not equals, regex. [P3]
- [ ] Specific tasks or subtasks are. [P3]
- [ ] Time estimate (set or unset, greater than, less than, equal). [P3]
- [ ] Time in status (more than X time in a status). [P3]
- [ ] AI condition ("describe any condition" in plain language). [P4]

Actions:
- [ ] Add comment (with variables and @mentions). [P3]
- [ ] Change assignees (add, remove, reassign, remove all) and change followers. [P3]
- [ ] Change status, priority, tags, start date and due date (relative to the trigger date, a fixed date, or remove). Change task name and task type. [P3]
- [ ] Update Custom Field (including dynamic dates from trigger fields). [P3]
- [ ] Estimate time and track time. [P3]
- [ ] Create task, create subtask (optionally from a template, optionally related or dependent), create List (from a template, in a chosen location), and duplicate task (optionally linked). [P3]
- [ ] Apply template (task or checklist). [P3]
- [ ] Move to List, add to List (multiple Lists), archive, and delete. [P3]
- [ ] Add relationship (task, Doc, dependency, custom). [P3]
- [ ] Add to current Sprint. [P3]
- [ ] Share task (with a permission level). [P3]
- [ ] Send channel message and send direct message. [P3]
- [ ] Send email (Email ClickApp) (?). [P6]
- [ ] Call webhook (outbound) and task webhook. [P3]
- [ ] AI actions — AI Assign, AI Prioritize, Refresh AI Field, Create task/Doc/subtask with AI, Edit field with AI, Launch Super Agent, and Autopilot Agent "do anything". [P4]

## 14. Forms
Sources: https://help.clickup.com/hc/en-us/articles/6310233090711-Intro-to-Forms-and-Form-view · https://clickup.com/features

- [ ] Form builder — drag task fields and Custom Fields in as questions. Each submission creates a task in the List. [P3]
- [ ] Question settings — label, description, required, hidden (pre-filled), and default values. [P3]
- [ ] Conditional logic — rules that show questions or set fields based on answers. Nests up to 5 levels. [P3]
- [ ] Layouts (all-on-one-page or one-per-page), theme, colors, cover image, and branding removal. [P3]
- [ ] Settings — apply a task template on submission, auto-assign, auto-rename submissions, set a thank-you message or redirect URL, and reCAPTCHA. [P3]
- [ ] Share — public link, embed code, and account-authenticated (internal-only) forms. [P3]
- [ ] Uploads — 25 MB per file. [P3]
- [ ] Forms Hub. Access and download submissions. Dashboards over submissions. [P3]

## 15. Templates
Sources: https://clickup.com/features · Help Center "Intro to templates"

- [ ] Template types — task, checklist, List, Folder, Space, Doc, page, view, Whiteboard and status templates. [P3]
- [ ] Save as template with include options (subtasks, checklists, attachments, comments, Custom Fields, dependencies, etc.). [P3]
- [ ] Apply a template with date remapping (relative to a new start or due date). Durations in templates. [P3]
- [ ] Template Center — browse and search, team templates vs ClickUp library. Add to library, tags and preview images. [P3]
- [ ] Template sharing (Workspace, specific people, public link) and public template restrictions. [P3]
- [ ] Update a template from its source. Delete templates. [P3]

## 16. Search & Command Center
Sources: https://clickup.com/features · Help Center "Search your Workspace", "What is the AI Command Bar?"

- [ ] Global search (Cmd/Ctrl+K) across tasks, Docs, Chat, Whiteboards, Dashboards, people and locations. [P2]
- [ ] Search filters — type, location, assignee, created by, status, task type, date. Recent searches. [P2]
- [ ] Command Bar actions — create items, navigate, run commands, and use keyboard shortcuts. [P2]
- [ ] Custom commands in the Command Bar. [P3]
- [ ] Connected Search — searches external apps (Google Drive, Gmail, Slack, Jira, Salesforce, etc.). [P6]
- [ ] AI answers in search (ask a question, get an answer with citations). [P4]
- [ ] Keyboard shortcuts system-wide. [P2]

## 17. Permissions, roles & sharing
Sources: https://help.clickup.com/hc/en-us/articles/6309225399703-Intro-to-permissions · https://help.clickup.com/hc/en-us/articles/6310033667223-Intro-to-user-roles · https://help.clickup.com/hc/en-us/articles/6310022323991-Guest-type-user-roles · https://help.clickup.com/hc/en-us/articles/6309195687959-Manage-Custom-Role-permissions

- [ ] Owner — one per Workspace. Transferable. Full control including billing and deletion. [P2]
- [ ] Admin — member plus Workspace management (people, settings, ClickApps, statuses). [P2]
- [ ] Member — full edit on all public locations by default. Can be restricted per item. [P2]
- [ ] Limited member (and limited member view-only) — internal-domain users who see only what is shared with them. [P3]
- [ ] Guest — external users. Access only to shared items and can't be invited to a whole Space. Types: view-only guest (free), permission-controlled guest, and Free-plan guest (full only). Users with the org email domain can't be guests. [P2]
- [ ] Item-level permission levels — Full edit (create, edit, share, delete), Edit (no delete), Comment (plus assignees may change status of their own tasks), View only. [P2]
- [ ] Per-location sharing — Space, Folder, List, task, Doc, view, Dashboard, Whiteboard and Channel. Permissions inherit downward and can be overridden. [P2]
- [ ] Private items — make a Folder, List, task, Doc, etc. private, then add specific people. [P2]
- [ ] Teams (user groups) — share and assign to Teams. [P3]
- [ ] Guest individual permissions — can see time estimates, see time tracked, add/remove tags, create views. [P3]
- [ ] Custom roles (Business Plus+) — granular toggles: Manage users, Manage Teams, Git, Edit statuses, Manage tags, Send email, Add email accounts, Share via Automations, Manage Custom Fields, Pinned Custom Fields, Custom roles, Create Spaces, Create views, Delete items ("only if created" option), Exporting, Export views, Importing, Workspace integrations, Personal integrations, Invite guests, etc. [P3]
- [ ] Invite permissions — who can invite members and guests. Restrict guest invites. [P2]
- [ ] Request access — users can request access, or request upgraded permission on an item. [P3]
- [ ] Public links — share an item publicly. Link expiration, limit public sharing, allow search-engine indexing, and an admin list of publicly shared items. [P3]
- [ ] Advanced security — 2FA, SSO (Google, Microsoft, Okta, SAML), session settings, and audit logs (?). [P6]
- [ ] People page — list, filter, convert roles, remove users, and export users. [P2]

## 18. Imports & exports
Sources: https://help.clickup.com/hc/en-us/articles/6311099045783-How-do-I-import-my-work-into-ClickUp · https://clickup.com/features

- [ ] Importers — Asana, Basecamp, Confluence, Jira, monday.com, Notion, Todoist, Teamwork, Trello, Slack and Wrike. [P6]
- [ ] Spreadsheet importer (CSV/Excel) with field mapping. Supported fields are documented. Date-format handling. [P6]
- [ ] User mapping during import (external emails mapped to Workspace users). [P6]
- [ ] Import history and management. [P6]
- [ ] Workspace export (CSV of all tasks). Export a List or Table view. Export Docs, Dashboards, cards, Whiteboards and Form responses. [P6]
- [ ] Export Workspace users. [P6]

## 19. Integrations & API
Sources: https://clickup.com/features · https://developer.clickup.com

- [ ] Public REST API (v2) — Workspaces, Spaces, Folders, Lists, tasks, subtasks, checklists, comments, Custom Fields, dependencies, tags, time tracking, Goals, views, members, guests, templates, Docs and Chat. [P6]
- [ ] Personal API tokens and OAuth apps. [P6]
- [ ] Webhooks — task created, updated, deleted, status, priority, assignee, due date, tag, moved, comment posted or updated, time estimate, and time tracked. List, Folder and Space created/updated/deleted. Goal and key result events. [P6]
- [ ] MCP server (an MCP integration is listed on the features page). [P6]
- [ ] Slack — notifications, unfurl previews, and create tasks from messages. [P6]
- [ ] Microsoft Teams. [P6]
- [ ] Code — GitHub, GitLab and Bitbucket (link commits, branches and PRs to task IDs; auto-status). [P6]
- [ ] Calendars — Google Calendar (two-way), Outlook Calendar, and iCal feed. [P6]
- [ ] Meetings — Zoom (start a meeting from a task), Google Meet, and Teams. [P6]
- [ ] Email — Gmail and Outlook Mail integration and Email ClickApp. Email-to-task. [P6]
- [ ] Cloud storage — Google Drive, Dropbox, Box, OneDrive and SharePoint (attach and browse). [P6]
- [ ] Two-way sync — Jira, Salesforce, Zendesk, Azure DevOps, Freshdesk, ServiceNow and QuickBooks Online. [P6]
- [ ] Automation platforms — Zapier, Make and similar. [P6]
- [ ] Others listed — HubSpot, Figma, Loom, Sentry, Datadog, Calendly, Twilio, Typeform, Canny, Incident.io, Rize, Morgen, Merge, etc. [P6]
- [ ] Chrome extension — save pages, emails and screenshots as tasks. Track time. [P6]
- [ ] Mobile apps (iOS/Android) and desktop app. Home-screen widgets. [P6]

## 20. ClickUp AI (Brain)
Sources: https://help.clickup.com/hc/en-us/articles/44297778247063-ClickUp-Brain-availability-and-limits · https://clickup.com/features · Help Center Brain articles

- [ ] Brain chat (AI sidebar) — ask questions over tasks, Docs, chat and people. Answers include citations. [P4]
- [ ] @mention Brain in comments, chat and Docs. [P4]
- [ ] Write with AI — draft, edit, rewrite, translate and summarize in any text field or Doc (/write). [P4]
- [ ] Summaries — task and location activity, Docs, comment threads, and chat catch-up. [P4]
- [ ] AI StandUps and team updates — generated from your recent activity. [P4]
- [ ] Create tasks and subtasks with AI from a description, comment or Doc. [P4]
- [ ] Autofill task properties — type, priority, assignee, etc. AI Assign and AI Prioritize. [P4]
- [ ] AI Fields — summary, progress update, translation, action items, sentiment, categorize, T-shirt size, and custom prompt fields. Refreshed by automation. [P4]
- [ ] AI List Builder — creates a List's statuses, fields and starter tasks from a description. [P4]
- [ ] AI-built filters and AI automation builder (describe automations in natural language) (?). [P4]
- [ ] AI Notetaker — joins Zoom, Meet and Teams calls to record, transcribe, summarize and extract action items. Meetings Hub. [P4]
- [ ] Talk to Text and voice clip transcription. [P4]
- [ ] Artifacts — AI-generated mini-apps, dashboards and slide decks. [P4]
- [ ] Super Agents and Autopilot Agents — configurable agents with instructions, knowledge, tools and memory, triggered by automations or chat. Agent catalog and activity log. [P4]
- [ ] AI Skills and saved prompts — reusable prompts that can be shared. [P4]
- [ ] Brain Memory — personal context retained across sessions. [P4]
- [ ] Image and video generation (?). [P4]
- [ ] Data analysis with Brain — ask about time tracking, task metrics, etc. [P4]
- [ ] Model picker (standard vs premium models) and usage analytics. Per-role AI access controls. [P4]
- [ ] Brain MAX — desktop, mobile and Chrome extension. Connected search across external apps. [P4]

## 21. Workspace settings & misc
Sources: https://help.clickup.com/hc/en-us/articles/6304327753111-Intro-to-ClickApps · https://clickup.com/features

- [ ] ClickApps center — Workspace and per-Space feature toggles (see the list in section 1). [P2]
- [ ] Workspace settings — name, logo, color, default permissions, and work schedule (working days and hours). [P2]
- [ ] User settings — profile, language, region, time and date formats, timezone, theme (dark mode, high contrast), and keyboard shortcuts on/off. [P2]
- [ ] Use Relative Dates toggle (e.g. "Tomorrow" vs 11/7). [P2]
- [ ] Teams Hub / People overview / org chart. [P3]
- [ ] Profiles and user status. [P3]
- [ ] Mobile parity — tasks, views, inbox, chat and docs. [P6]

---

## Counts (exact tally of checklist lines)

| # | Area | Items | P2 | P3 | P4 | P6 |
|---|------|------:|---:|---:|---:|---:|
| 1 | Hierarchy & navigation | 31 | 22 | 9 | 0 | 0 |
| 2 | Statuses | 18 | 13 | 5 | 0 | 0 |
| 3 | Task fields & detail | 44 | 16 | 27 | 0 | 1 |
| 4 | Custom Fields | 34 | 0 | 33 | 1 | 0 |
| 5 | Views | 49 | 18 | 29 | 2 | 0 |
| 6 | Collaboration | 32 | 14 | 18 | 0 | 0 |
| 7 | Docs | 16 | 0 | 15 | 0 | 1 |
| 8 | Whiteboards | 4 | 0 | 4 | 0 | 0 |
| 9 | Goals | 7 | 0 | 7 | 0 | 0 |
| 10 | Dashboards | 10 | 0 | 9 | 1 | 0 |
| 11 | Time tracking | 12 | 0 | 11 | 0 | 1 |
| 12 | Sprints | 9 | 0 | 9 | 0 | 0 |
| 13 | Automations | 45 | 0 | 41 | 2 | 2 |
| 14 | Forms | 8 | 0 | 8 | 0 | 0 |
| 15 | Templates | 6 | 0 | 6 | 0 | 0 |
| 16 | Search | 7 | 4 | 1 | 1 | 1 |
| 17 | Permissions | 16 | 9 | 6 | 0 | 1 |
| 18 | Imports/exports | 6 | 0 | 0 | 0 | 6 |
| 19 | Integrations/API | 16 | 0 | 0 | 0 | 16 |
| 20 | AI (Brain) | 20 | 0 | 0 | 20 | 0 |
| 21 | Settings & misc | 7 | 4 | 2 | 0 | 1 |
| | **Total** | **397** | **100** | **240** | **27** | **30** |

Some lines bundle several sub-features (e.g. dashboard card families, the date-trigger group in Automations), so the true feature count is higher.
