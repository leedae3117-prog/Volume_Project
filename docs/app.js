const BODY_PARTS = ["가슴", "등", "하체", "어깨", "팔", "복근", "기타"];
const USER_ID = "daeyeon";
const SUPABASE_URL = "https://fxvrdevsyxpvtvpwiedj.supabase.co";
const SUPABASE_KEY = "sb_publishable_T6DuYZZ0LHoJFn6hdEU3fQ_5-oGy2D3";
const MAX_SETS = 30;
const MIN_SETS = 1;

let db = null;
let setCount = 4;
let sets = [];
let editTarget = null;
let currentMonth = "";
let recordsCache = [];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function koreaToday() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function monthOf(dateText) {
  return dateText.slice(0, 7);
}

function parseDateText(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateText(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatKg(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}kg`;
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2200);
}

function connectSupabase() {
  if (!window.supabase) return false;
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return true;
}

async function queryRecords() {
  if (!db) return [];
  const { data, error } = await db
    .from("workout_sets")
    .select("*")
    .eq("user_id", USER_ID)
    .order("workout_date", { ascending: false })
    .order("exercise_name", { ascending: true })
    .order("set_no", { ascending: true });

  if (error) throw error;
  recordsCache = data || [];
  return recordsCache;
}

async function queryDateRecords(dateText) {
  if (!db) return [];
  const { data, error } = await db
    .from("workout_sets")
    .select("*")
    .eq("user_id", USER_ID)
    .eq("workout_date", dateText)
    .order("created_at", { ascending: false })
    .order("exercise_name", { ascending: true })
    .order("set_no", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function deleteWorkoutGroup(target) {
  const { error } = await db
    .from("workout_sets")
    .delete()
    .eq("user_id", USER_ID)
    .eq("workout_date", target.workout_date)
    .eq("body_part", target.body_part)
    .eq("exercise_name", target.exercise_name);

  if (error) throw error;
}

async function insertWorkoutRows(rows) {
  const { error } = await db.from("workout_sets").insert(rows);
  if (error) throw error;
}

function resetSets(nextCount = 4) {
  setCount = nextCount;
  sets = Array.from({ length: setCount }, () => ({ weight: 0, reps: 0 }));
  renderSets();
}

function setValue(index, key, value) {
  sets[index][key] = Math.max(0, Number(value || 0));
  renderSets();
}

function changeValue(index, key, delta) {
  setValue(index, key, sets[index][key] + delta);
}

function renderSets() {
  $("#setCountLabel").textContent = `${setCount}set`;
  $("#setList").innerHTML = sets
    .map((item, index) => {
      const no = index + 1;
      const volume = item.weight * item.reps;
      const before = no === 1
        ? ""
        : `<div class="before-row"><span></span><button data-before="${index}" type="button">Before =</button></div>`;

      return `
        ${before}
        <div class="set-row">
          <div class="set-label">${no}set</div>
          <div class="number-box">
            <button data-minus-weight="${index}" type="button">-</button>
            <input data-weight="${index}" inputmode="decimal" value="${item.weight}" />
            <button data-plus-weight="${index}" type="button">+</button>
          </div>
          <div class="number-box">
            <button data-minus-reps="${index}" type="button">-</button>
            <input data-reps="${index}" inputmode="numeric" value="${item.reps}" />
            <button data-plus-reps="${index}" type="button">+</button>
          </div>
          <div class="volume-cell">${formatKg(volume)}</div>
        </div>
      `;
    })
    .join("");

  const total = sets.reduce((sum, item) => sum + item.weight * item.reps, 0);
  $("#exerciseVolume").textContent = `${total.toLocaleString("ko-KR")} kg`;
}

function resizeSets(nextCount) {
  setCount = Math.max(MIN_SETS, Math.min(MAX_SETS, nextCount));
  while (sets.length < setCount) sets.push({ weight: 0, reps: 0 });
  sets = sets.slice(0, setCount);
  renderSets();
}

function rowsForSave() {
  const dateText = $("#workoutDate").value;
  const bodyPart = $("#bodyPart").value;
  const exerciseName = $("#exerciseName").value.trim();

  return sets
    .map((item, index) => ({
      user_id: USER_ID,
      workout_date: dateText,
      body_part: bodyPart,
      exercise_name: exerciseName,
      set_no: index + 1,
      weight: item.weight,
      reps: item.reps,
      volume: item.weight * item.reps,
    }))
    .filter((row) => row.weight > 0 && row.reps > 0);
}

function resetForm() {
  editTarget = null;
  $("#exerciseName").value = "";
  $("#saveWorkoutButton").textContent = "운동 저장";
  $("#cancelEditButton").classList.add("hidden");
  resetSets(4);
}

function groupByExercise(records) {
  const map = new Map();
  for (const row of records) {
    const key = `${row.workout_date}|${row.body_part}|${row.exercise_name}`;
    if (!map.has(key)) {
      map.set(key, {
        workout_date: row.workout_date,
        body_part: row.body_part,
        exercise_name: row.exercise_name,
        volume: 0,
        rows: [],
      });
    }
    const group = map.get(key);
    group.volume += Number(row.volume || 0);
    group.rows.push(row);
  }
  return [...map.values()].sort((a, b) => b.volume - a.volume);
}

async function renderTodayRecords() {
  const dateText = $("#workoutDate").value;
  const records = await queryDateRecords(dateText);
  const groups = groupByExercise(records);
  const total = records.reduce((sum, row) => sum + Number(row.volume || 0), 0);

  $("#todaySummary").innerHTML = groups.length
    ? `<p class="muted">오늘 총 볼륨 ${formatKg(total)}</p>` + groups.map((group, index) => `
        <div class="record-card">
          <div class="record-main">
            <strong>${group.body_part}</strong>
            <span>${group.exercise_name}</span>
            <span>${formatKg(group.volume)}</span>
            <button data-edit="${index}" type="button">수정</button>
          </div>
        </div>
      `).join("")
    : `<p class="muted">아직 오늘 저장된 기록이 없습니다.</p>`;

  $("#todayDetail").innerHTML = records.length ? table(records) : `<p class="muted">기록 없음</p>`;

  $$("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => loadGroupIntoForm(groups[Number(button.dataset.edit)]));
  });
}

function loadGroupIntoForm(group) {
  editTarget = {
    workout_date: group.workout_date,
    body_part: group.body_part,
    exercise_name: group.exercise_name,
  };
  $("#workoutDate").value = group.workout_date;
  $("#bodyPart").value = group.body_part;
  $("#exerciseName").value = group.exercise_name;
  setCount = Math.max(4, Math.min(MAX_SETS, Math.max(...group.rows.map((row) => Number(row.set_no)))));
  sets = Array.from({ length: setCount }, () => ({ weight: 0, reps: 0 }));
  for (const row of group.rows) {
    sets[Number(row.set_no) - 1] = { weight: Number(row.weight), reps: Number(row.reps) };
  }
  $("#saveWorkoutButton").textContent = "수정 저장";
  $("#cancelEditButton").classList.remove("hidden");
  renderSets();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function table(records) {
  return `
    <table class="table">
      <thead><tr><th>부위</th><th>운동명</th><th>세트</th><th>무게</th><th>횟수</th><th>볼륨</th></tr></thead>
      <tbody>
        ${records.map((row) => `
          <tr>
            <td>${row.body_part}</td>
            <td>${row.exercise_name}</td>
            <td>${row.set_no}</td>
            <td>${Number(row.weight).toLocaleString("ko-KR")}</td>
            <td>${row.reps}</td>
            <td>${formatKg(row.volume)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function startOfWeek(dateText) {
  const date = parseDateText(dateText);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return formatDateText(date);
}

function addDays(dateText, days) {
  const date = parseDateText(dateText);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateText(date);
}

function dateLabel(dateText) {
  const [, month, day] = dateText.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function renderMonth() {
  const monthRecords = recordsCache.filter((row) => monthOf(row.workout_date) === currentMonth);
  $("#monthLabel").textContent = currentMonth;

  const weekMap = new Map();
  for (const row of recordsCache) {
    const weekStart = startOfWeek(row.workout_date);
    const weekEnd = addDays(weekStart, 6);
    if (weekStart.slice(0, 7) !== currentMonth && weekEnd.slice(0, 7) !== currentMonth) continue;
    if (!weekMap.has(weekStart)) weekMap.set(weekStart, { total: 0, days: new Map() });
    const week = weekMap.get(weekStart);
    week.total += Number(row.volume || 0);
    week.days.set(row.workout_date, (week.days.get(row.workout_date) || 0) + Number(row.volume || 0));
  }

  $("#weeklyList").innerHTML = [...weekMap.entries()].sort().map(([weekStart, week]) => `
    <details class="week-card">
      <summary>${dateLabel(weekStart)} ~ ${dateLabel(addDays(weekStart, 6))} · ${formatKg(week.total)}</summary>
      ${["월", "화", "수", "목", "금", "토", "일"].map((label, index) => {
        const day = addDays(weekStart, index);
        const value = week.days.get(day) || 0;
        return `<p>${label} ${dateLabel(day)} · ${value ? formatKg(value) : "휴식"}</p>`;
      }).join("")}
    </details>
  `).join("") || `<p class="muted">선택한 월의 기록이 없습니다.</p>`;

  const dayMap = new Map();
  for (const row of monthRecords) {
    if (!dayMap.has(row.workout_date)) dayMap.set(row.workout_date, []);
    dayMap.get(row.workout_date).push(row);
  }
  $("#dailyList").innerHTML = [...dayMap.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, rows]) => {
    const total = rows.reduce((sum, row) => sum + Number(row.volume || 0), 0);
    return `
      <details class="day-card">
        <summary>${day} · 총 ${formatKg(total)}</summary>
        ${table(rows)}
      </details>
    `;
  }).join("") || `<p class="muted">선택한 월의 날짜별 기록이 없습니다.</p>`;
}

function renderPartPage() {
  const selected = $("#partFilter").value;
  const partRows = recordsCache.filter((row) => row.body_part === selected);
  const dayMap = new Map();
  for (const row of partRows) {
    dayMap.set(row.workout_date, (dayMap.get(row.workout_date) || 0) + Number(row.volume || 0));
  }
  const daily = [...dayMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  if (!daily.length) {
    $("#partStats").innerHTML = `<p class="muted">${selected} 기록이 없습니다.</p>`;
    $("#partChart").innerHTML = "";
    $("#partDetail").innerHTML = "";
    return;
  }

  const diff = daily.length >= 2 ? daily[0][1] - daily[1][1] : 0;
  $("#partStats").innerHTML = `<p>최근 ${formatKg(daily[0][1])}</p><p class="muted">직전 운동 대비 ${diff >= 0 ? "+" : ""}${formatKg(diff)}</p>`;

  const chartData = daily.slice(0, 8).reverse();
  const max = Math.max(...chartData.map(([, value]) => value), 1);
  $("#partChart").innerHTML = chartData.map(([day, value]) => `
    <div class="bar">
      <strong>${dateLabel(day)}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, (value / max) * 100)}%">${formatKg(value)}</div></div>
      <span>${formatKg(value)}</span>
    </div>
  `).join("");

  const latestRows = partRows.filter((row) => row.workout_date === daily[0][0]);
  $("#partDetail").innerHTML = `<h2>최근 ${selected} 운동 상세 · ${daily[0][0]}</h2>${table(latestRows)}`;
}

async function refreshAll() {
  if (!db) return;
  await renderTodayRecords();
  await queryRecords();
  if (!currentMonth) currentMonth = monthOf($("#workoutDate").value);
  renderMonth();
  renderPartPage();
}

function bindEvents() {
  $$(".nav-tabs button").forEach((button) => {
    button.addEventListener("click", async () => {
      $$(".nav-tabs button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      $$(".page").forEach((page) => page.classList.add("hidden"));
      $(`#${button.dataset.page}Page`).classList.remove("hidden");
      if (button.dataset.page !== "today") {
        await queryRecords();
        renderMonth();
        renderPartPage();
      }
    });
  });

  $("#workoutDate").addEventListener("change", async () => {
    currentMonth = monthOf($("#workoutDate").value);
    await renderTodayRecords();
  });
  $("#addSetButton").addEventListener("click", () => resizeSets(setCount + 1));
  $("#removeSetButton").addEventListener("click", () => resizeSets(setCount - 1));
  $("#cancelEditButton").addEventListener("click", resetForm);
  $("#partFilter").addEventListener("change", renderPartPage);
  $("#prevMonthButton").addEventListener("click", () => {
    const date = parseDateText(`${currentMonth}-01`);
    date.setUTCMonth(date.getUTCMonth() - 1);
    currentMonth = formatDateText(date).slice(0, 7);
    renderMonth();
  });
  $("#nextMonthButton").addEventListener("click", () => {
    const date = parseDateText(`${currentMonth}-01`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    currentMonth = formatDateText(date).slice(0, 7);
    renderMonth();
  });

  let lastSetActionAt = 0;
  function handleSetAction(event) {
    const target = event.target.closest("button");
    if (!target || !$("#setList").contains(target)) return;

    if (event.type === "touchend") {
      event.preventDefault();
      lastSetActionAt = Date.now();
    } else if (Date.now() - lastSetActionAt < 450) {
      return;
    }

    if (target.dataset.plusWeight) changeValue(Number(target.dataset.plusWeight), "weight", 5);
    if (target.dataset.minusWeight) changeValue(Number(target.dataset.minusWeight), "weight", -5);
    if (target.dataset.plusReps) changeValue(Number(target.dataset.plusReps), "reps", 1);
    if (target.dataset.minusReps) changeValue(Number(target.dataset.minusReps), "reps", -1);
    if (target.dataset.before) {
      const index = Number(target.dataset.before);
      sets[index] = { ...sets[index - 1] };
      renderSets();
    }
  }

  $("#setList").addEventListener("click", handleSetAction);
  $("#setList").addEventListener("touchend", handleSetAction, { passive: false });

  $("#setList").addEventListener("input", (event) => {
    const target = event.target;
    if (target.dataset.weight) setValue(Number(target.dataset.weight), "weight", target.value);
    if (target.dataset.reps) setValue(Number(target.dataset.reps), "reps", target.value);
  });

  $("#saveWorkoutButton").addEventListener("click", async () => {
    try {
      if (!db && !connectSupabase()) return toast("Supabase 연결에 실패했습니다.");
      const rows = rowsForSave();
      if (!$("#exerciseName").value.trim()) return toast("운동명을 입력해주세요.");
      if (!rows.length) return toast("무게와 횟수가 입력된 세트가 없습니다.");
      if (editTarget) await deleteWorkoutGroup(editTarget);
      await insertWorkoutRows(rows);
      toast(editTarget ? "수정했습니다." : "저장했습니다.");
      resetForm();
      await refreshAll();
    } catch (error) {
      toast(error.message || "저장 중 오류가 발생했습니다.");
    }
  });
}

async function init() {
  $("#workoutDate").value = koreaToday();
  $("#bodyPart").innerHTML = BODY_PARTS.map((part) => `<option>${part}</option>`).join("");
  $("#partFilter").innerHTML = BODY_PARTS.map((part) => `<option>${part}</option>`).join("");
  currentMonth = monthOf($("#workoutDate").value);
  resetSets(4);
  bindEvents();
  if (connectSupabase()) {
    try {
      await refreshAll();
    } catch (error) {
      toast(error.message || "데이터를 불러오지 못했습니다.");
    }
  }
}

init();
