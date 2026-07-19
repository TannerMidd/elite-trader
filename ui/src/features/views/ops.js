/**
 * Static markup owned by the ops feature surface.
 *
 * Values from APIs, journals, EDDN, localStorage, and forms never belong in
 * this template; dynamic content is rendered through core/html.js.
 */
export const opsView = String.raw`<div class="tabpane hidden" id="tab-ops">
    <div class="ops-scope" role="note">
      <b>LOCAL MISSION CONTROL</b>
      Plans, objectives, learned timings and shared boards stay on your machine. Board exchange is a JSON file;
      no account, API key or online service is involved.
    </div>

    <section class="card" id="ops-plan-card" data-arr="opsplan">
      <div class="card-head">
        <div class="label">SESSION PLAN <span class="dim">time-budgeted · dependencies included · local state only</span></div>
        <div id="ops-plan-meta" class="value dim">NOT PLANNED</div>
      </div>
      <form id="ops-plan-form" class="ops-form ops-plan-form">
        <label>Time available (minutes)
          <input id="ops-budget" type="number" min="5" max="1440" step="5" value="90" required>
        </label>
        <label>Maximum tasks
          <input id="ops-max-tasks" type="number" min="1" max="24" value="6" required>
        </label>
        <button id="ops-plan-go" class="hb hb-primary" type="submit">BUILD SESSION PLAN</button>
      </form>
      <div id="ops-plan-status" class="dim">Frameshift will rank known work by urgency, value, risk and your available time.</div>
      <div id="ops-plan-warnings" class="ops-warnings hidden" role="status"></div>
      <div id="ops-plan-selected" class="ops-task-list"></div>
      <details id="ops-alternatives-wrap" class="ops-disclosure hidden">
        <summary><span>ALTERNATIVES</span><span id="ops-alternative-count" class="dim"></span></summary>
        <div id="ops-plan-alternatives" class="ops-task-list ops-alternatives"></div>
      </details>
      <details class="ops-disclosure">
        <summary><span>LEARNED TIMINGS</span><span id="ops-timing-summary" class="dim">LOADING…</span></summary>
        <div id="ops-timing-list"></div>
      </details>
    </section>

    <section class="card" id="ops-objectives-card" data-arr="objectives">
      <div class="card-head">
        <div class="label">PERSONAL OBJECTIVES <span class="dim">durable per commander · used by the session planner</span></div>
        <div class="ops-head-actions">
          <select id="ops-objective-filter" aria-label="Filter personal objectives by status">
            <option value="current">CURRENT</option>
            <option value="all">ALL</option>
            <option value="done">COMPLETED</option>
          </select>
          <span id="ops-objective-count" class="value dim"></span>
        </div>
      </div>
      <form id="ops-objective-form" class="ops-form ops-objective-form">
        <input id="ops-objective-id" type="hidden">
        <label class="ops-grow">Objective
          <input id="ops-objective-title" type="text" maxlength="240" placeholder="Deliver tritium to the carrier" required>
        </label>
        <label>Category
          <select id="ops-objective-category">
            <option value="other">Other</option>
            <option value="missions">Missions</option>
            <option value="trade">Trade</option>
            <option value="engineering">Engineering</option>
            <option value="exploration">Exploration</option>
            <option value="exobiology">Exobiology</option>
            <option value="mining">Mining</option>
            <option value="combat">Combat / AX</option>
            <option value="carrier">Fleet carrier</option>
            <option value="colonisation">Colonisation</option>
            <option value="powerplay">Powerplay</option>
          </select>
        </label>
        <label>Priority
          <input id="ops-objective-priority" type="number" min="0" max="100" value="50">
        </label>
        <label>Estimate (minutes)
          <input id="ops-objective-minutes" type="number" min="1" max="1440" step="1" placeholder="15">
        </label>
        <label>System
          <input id="ops-objective-system" type="text" maxlength="160" placeholder="Optional">
        </label>
        <label>Station
          <input id="ops-objective-station" type="text" maxlength="160" placeholder="Optional">
        </label>
        <label>Body
          <input id="ops-objective-body" type="text" maxlength="200" placeholder="Optional">
        </label>
        <label>Deadline
          <input id="ops-objective-deadline" type="datetime-local">
        </label>
        <label>Status
          <select id="ops-objective-status">
            <option value="open">Open</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
        <button id="ops-objective-save" class="hb hb-primary" type="submit">ADD OBJECTIVE</button>
        <button id="ops-objective-cancel" class="hb hb-ghost hidden" type="button">CANCEL EDIT</button>
      </form>
      <div id="ops-objective-statusline" class="dim"></div>
      <div id="ops-objective-list" class="ops-record-list"></div>
    </section>

    <section class="card" id="ops-board-card" data-arr="operations">
      <div class="card-head ops-board-head">
        <div class="label">OPERATIONS BOARD <span class="dim">account-free coordination · deterministic file merge</span></div>
        <div class="ops-head-actions">
          <select id="ops-board-select" aria-label="Select operations board"><option value="">NO BOARDS</option></select>
          <button id="ops-board-refresh" class="hb hb-utility" type="button">REFRESH</button>
          <button id="ops-board-export" class="hb hb-utility" type="button" disabled>EXPORT JSON</button>
          <button id="ops-board-import-trigger" class="hb hb-utility ops-file-button" type="button">IMPORT JSON</button>
          <input id="ops-board-import" type="file" accept="application/json,.json" hidden>
        </div>
      </div>
      <details class="ops-composer" id="ops-new-board-wrap">
        <summary>NEW OPERATIONS BOARD</summary>
        <form id="ops-board-form" class="ops-form">
          <label class="ops-grow">Title
            <input id="ops-board-title" type="text" maxlength="240" placeholder="Thursday AX wing" required>
          </label>
          <label class="ops-grow">Briefing
            <input id="ops-board-description" type="text" maxlength="1000" placeholder="Scope, rendezvous and success condition">
          </label>
          <button class="hb hb-primary" type="submit">CREATE BOARD</button>
        </form>
      </details>
      <div id="ops-import-report" class="dim"></div>
      <div id="ops-board-empty" class="empty dim">Create a board here or import one shared by another commander.</div>

      <div id="ops-board-workspace" class="hidden">
        <div class="ops-board-banner">
          <div>
            <h2 id="ops-board-name"></h2>
            <div id="ops-board-meta" class="dim"></div>
            <p id="ops-board-briefing"></p>
          </div>
          <div class="ops-head-actions">
            <select id="ops-board-status" aria-label="Operations board status">
              <option value="active">ACTIVE</option>
              <option value="paused">PAUSED</option>
              <option value="complete">COMPLETE</option>
              <option value="archived">ARCHIVED</option>
            </select>
            <button id="ops-board-delete" class="hb hb-utility hb-danger" type="button">DELETE BOARD</button>
          </div>
        </div>
        <div id="ops-conflicts" class="ops-conflicts hidden" role="status"></div>

        <div class="ops-board-grid">
          <section class="ops-lane">
            <div class="label">BOARD OBJECTIVES</div>
            <form id="ops-board-objective-form" class="ops-mini-form">
              <input id="ops-board-objective-title" type="text" maxlength="240" placeholder="Objective" aria-label="Objective title" required>
              <input id="ops-board-objective-description" type="text" maxlength="1000" placeholder="Success condition / notes" aria-label="Objective description">
              <input id="ops-board-objective-system" type="text" maxlength="160" placeholder="System" aria-label="Objective system">
              <input id="ops-board-objective-station" type="text" maxlength="160" placeholder="Station / body" aria-label="Objective station or body">
              <input id="ops-board-objective-deadline" type="datetime-local" title="Deadline" aria-label="Objective deadline">
              <input id="ops-board-objective-priority" type="number" min="0" max="100" value="50" title="Priority" aria-label="Objective priority">
              <button class="hb hb-primary hb-sm" type="submit">ADD</button>
            </form>
            <div id="ops-board-objectives" class="ops-record-list"></div>
          </section>

          <section class="ops-lane">
            <div class="label">ASSIGNMENTS</div>
            <form id="ops-assignment-form" class="ops-mini-form">
              <select id="ops-assignment-objective" aria-label="Assignment objective"><option value="">Whole board</option></select>
              <input id="ops-assignment-name" type="text" maxlength="160" placeholder="Commander / wing" aria-label="Assigned commander or wing" required>
              <input id="ops-assignment-role" type="text" maxlength="160" placeholder="Role" aria-label="Assignment role">
              <button class="hb hb-primary hb-sm" type="submit">ASSIGN</button>
            </form>
            <div id="ops-assignments" class="ops-record-list"></div>
          </section>

          <section class="ops-lane">
            <div class="label">RESERVATIONS <span class="dim">prevent duplicated hauling or material work</span></div>
            <form id="ops-reservation-form" class="ops-mini-form">
              <select id="ops-reservation-objective" aria-label="Reservation objective"><option value="">Whole board</option></select>
              <select id="ops-reservation-type" aria-label="Resource type">
                <option value="commodity">Commodity</option>
                <option value="material">Engineering material</option>
                <option value="carrier_cargo">Carrier cargo</option>
                <option value="task">Task capacity</option>
              </select>
              <input id="ops-reservation-key" type="text" maxlength="200" placeholder="Resource" aria-label="Reserved resource" required>
              <input id="ops-reservation-amount" type="number" min="0.01" step="any" placeholder="Amount" aria-label="Reserved amount" required>
              <input id="ops-reservation-unit" type="text" maxlength="40" placeholder="t / units" aria-label="Reservation unit">
              <input id="ops-reservation-assignee" type="text" maxlength="160" placeholder="Reserved by" aria-label="Reservation owner">
              <button class="hb hb-primary hb-sm" type="submit">RESERVE</button>
            </form>
            <div id="ops-reservations" class="ops-record-list"></div>
          </section>

          <section class="ops-lane">
            <div class="label">CONTRIBUTIONS <span class="dim">append-only progress evidence</span></div>
            <form id="ops-contribution-form" class="ops-mini-form">
              <select id="ops-contribution-objective" aria-label="Contribution objective"><option value="">Whole board</option></select>
              <input id="ops-contribution-name" type="text" maxlength="160" placeholder="Commander" aria-label="Contributing commander" required>
              <input id="ops-contribution-kind" type="text" maxlength="100" placeholder="Cargo / kills / scans" aria-label="Contribution type" required>
              <input id="ops-contribution-amount" type="number" min="0.01" step="any" placeholder="Amount" aria-label="Contribution amount" required>
              <input id="ops-contribution-unit" type="text" maxlength="40" placeholder="t / bonds" aria-label="Contribution unit">
              <input id="ops-contribution-note" type="text" maxlength="1000" placeholder="Note or evidence" aria-label="Contribution note or evidence">
              <button class="hb hb-primary hb-sm" type="submit">LOG</button>
            </form>
            <div id="ops-contributions" class="ops-record-list"></div>
          </section>
        </div>
      </div>
    </section>
  </div>`;
