import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const BODY_PARTS = ["가슴", "등", "하체", "어깨", "팔", "복근", "기타"];
const USER_ID = "daeyeon";
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAoCjy5xlm-A0ndbHqPTelgaZRGL6flWZ0",
  authDomain: "workouts-1d158.firebaseapp.com",
  projectId: "workouts-1d158",
  storageBucket: "workouts-1d158.firebasestorage.app",
  messagingSenderId: "373675830183",
  appId: "1:373675830183:web:11195b4847ee24e7236482",
  measurementId: "G-DQ05R5HYHB",
};
const WORKOUT_COLLECTION = "workout_sets";
const MAX_SETS = 30;
const MIN_SETS = 1;
const LB_PER_KG = 2.2046226218;

let db = null;
let setCount = 4;
let sets = [];
let editTarget = null;
let currentMonth = "";
let recordsCache = [];
let weightUnit = "kg";

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

function formatWeightInput(weightKg) {
  const value = weightUnit === "lb" ? weightKg * LB_PER_KG : weightKg;
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded.toFixed(1));
}

function weightInputToKg(value) {
  const number = Math.max(0, Number(value || 0));
  return weightUnit === "lb" ? number / LB_PER_KG : number;
}

function weightStepKg() {
  return weightUnit === "lb" ? 5 / LB_PER_KG : 5;
}

function updateWeightUnitLabel() {
  const label = $("#weightUnitLabel");
  if (label) label.textContent = `무게(${weightUnit})`;
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2200);
}

function connectFirebase() {
  db = getFirestore(initializeApp(FIREBASE_CONFIG));
  return true;
}

function savedOrderSort(a, b) {
  return String(a.created_at || "").localeCompare(String(b.created_at || ""))
    || Number(a.set_no) - Number(b.set_no);
}

function rowSort(a, b) {
  return b.workout_date.localeCompare(a.workout_date) || savedOrderSort(a, b);
}

async function queryRecords() {
  if (!db) return [];
  const snapshot = await getDocs(query(
    collection(db, WORKOUT_COLLECTION),
    where("user_id", "==", USER_ID)
  ));
  recordsCache = snapshot.docs.map((item) => item.data()).sort(rowSort);
  return recordsCache;
}

async function queryDateRecords(dateText) {
  if (!db) return [];
  const snapshot = await getDocs(query(
    collection(db, WORKOUT_COLLECTION),
    where("user_id", "==", USER_ID)
  ));
  return snapshot.docs
    .map((item) => item.data())
    .filter((row) => row.workout_date === dateText)
    .sort(savedOrderSort);
}

async function deleteWorkoutGroup(target) {
  const snapshot = await getDocs(query(
    collection(db, WORKOUT_COLLECTION),
    where("user_id", "==", USER_ID)
  ));
  const batch = writeBatch(db);
  snapshot.docs
    .filter((item) => {
      const row = item.data();
      return row.workout_date === target.workout_date
        && row.body_part === target.body_part
        && row.exercise_name === target.exercise_name;
    })
    .forEach((item) => batch.delete(item.ref));
  await batch.commit();
}

async function insertWorkoutRows(rows) {
  const batch = writeBatch(db);
  const createdAt = new Date().toISOString();
  rows.forEach((row) => batch.set(doc(collection(db, WORKOUT_COLLECTION)), {
    ...row,
    created_at: createdAt,
  }));
  await batch.commit();
}

function resetSets(nextCount = 4) {
  setCount = nextCount;
  sets = Array.from({ length: setCount }, () => ({ weight: 0, reps: 0 }));
  renderSets();
}

function updateTotalsOnly() {
  const total = sets.reduce((sum, item) => sum + item.weight * item.reps, 0);
  $("#exerciseVolume").textContent = `${total.toLocaleString("ko-KR")} kg`;
}

function updateSetVolume(index) {
  const row = document.querySelector(`[data-set-row="${index}"]`);
  if (!row) return;
  const volume = sets[index].weight * sets[index].reps;
  row.querySelector(".volume-cell").textContent = formatKg(volume);
  updateTotalsOnly();
}

function setValue(index, key, value, shouldRender = true) {
  sets[index][key] = Math.max(0, Number(value || 0));
  if (shouldRender) {
    renderSets();
  } else {
    updateSetVolume(index);
  }
}

function changeValue(index, key, delta) {
  setValue(index, key, sets[index][key] + delta, true);
}

function renderSets() {
  updateWeightUnitLabel();
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
        <div class="set-row" data-set-row="${index}">
          <div class="set-label">${no}set</div>
          <div class="number-box">
            <button data-minus-weight="${index}" type="button">-</button>
            <input data-weight="${index}" inputmode="decimal" value="${formatWeightInput(item.weight)}" />
            <button data-plus-weight="${index}" type="button">+</button>
          </div>
          <div class="number-box">
            <button data-minus-reps="${index}" type="button">-</button>
            <input data-reps="${index}" inputmode="decimal" value="${item.reps}" />
            <button data-plus-reps="${index}" type="button">+</button>
          </div>
          <div class="volume-cell">${formatKg(volume)}</div>
        </div>
      `;
    })
    .join("");

  updateTotalsOnly();
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
  return [...map.values()];
}

function exerciseGroupsFor(part, name) {
  return groupByExercise(recordsCache.filter((row) =>
    row.body_part === part && (!name || row.exercise_name === name)
  ));
}

function updateExerciseSuggestions() {
  const names = [...new Set(exerciseGroupsFor($("#bodyPart").value).map((group) => group.exercise_name))];
  $("#exerciseSuggestions").innerHTML = names.map((name) => `<option value="${name}"></option>`).join("");
}

function loadLatestExerciseSuggestion() {
  const name = $("#exerciseName").value.trim();
  if (editTarget || !name) return;
  const group = exerciseGroupsFor($("#bodyPart").value, name)[0];
  if (group) loadGroupIntoForm(group, { keepDate: true, keepMode: true });
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
            <button data-delete="${index}" type="button">삭제</button>
          </div>
        </div>
      `).join("")
    : `<p class="muted">아직 오늘 저장된 기록이 없습니다.</p>`;

  $("#todayDetail").innerHTML = records.length ? table(records) : `<p class="muted">기록 없음</p>`;

  $$("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => loadGroupIntoForm(groups[Number(button.dataset.edit)]));
  });
  $$("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("삭제하시겠습니까?")) return;
      try {
        await deleteWorkoutGroup(groups[Number(button.dataset.delete)]);
        toast("삭제했습니다.");
        await refreshAll();
      } catch (error) {
        toast(error.message || "삭제 중 오류가 발생했습니다.");
      }
    });
  });
}

function loadGroupIntoForm(group, options = {}) {
  editTarget = options.keepMode ? null : {
    workout_date: group.workout_date,
    body_part: group.body_part,
    exercise_name: group.exercise_name,
  };
  if (!options.keepDate) $("#workoutDate").value = group.workout_date;
  $("#bodyPart").value = group.body_part;
  $("#exerciseName").value = group.exercise_name;
  setCount = Math.max(4, Math.min(MAX_SETS, Math.max(...group.rows.map((row) => Number(row.set_no)))));
  sets = Array.from({ length: setCount }, () => ({ weight: 0, reps: 0 }));
  for (const row of group.rows) {
    sets[Number(row.set_no) - 1] = { weight: Number(row.weight), reps: Number(row.reps) };
  }
  $("#saveWorkoutButton").textContent = options.keepMode ? "운동 저장" : "수정 저장";
  $("#cancelEditButton").classList.toggle("hidden", !!options.keepMode);
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
  renderMonthlyPartChart(monthRecords);

  const weekMap = new Map();
  for (const row of recordsCache) {
    const weekStart = startOfWeek(row.workout_date);
    const weekEnd = addDays(weekStart, 6);
    if (weekStart.slice(0, 7) !== currentMonth && weekEnd.slice(0, 7) !== currentMonth) continue;
    if (!weekMap.has(weekStart)) weekMap.set(weekStart, { total: 0, days: new Map() });
    const week = weekMap.get(weekStart);
    const volume = Number(row.volume || 0);
    week.total += volume;
    if (!week.days.has(row.workout_date)) week.days.set(row.workout_date, { parts: new Map() });
    const dayRecord = week.days.get(row.workout_date);
    dayRecord.parts.set(row.body_part, (dayRecord.parts.get(row.body_part) || 0) + volume);
  }

  $("#weeklyList").innerHTML = [...weekMap.entries()].sort().map(([weekStart, week]) => `
    <details class="week-card">
      <summary>${dateLabel(weekStart)} ~ ${dateLabel(addDays(weekStart, 6))} · ${formatKg(week.total)}</summary>
      ${["월", "화", "수", "목", "금", "토", "일"].map((label, index) => {
        const day = addDays(weekStart, index);
        const dayRecord = week.days.get(day);
        const detail = dayRecord
          ? [...dayRecord.parts.entries()].sort((a, b) => b[1] - a[1]).map(([part, value]) => `${part} ${formatKg(value)}`).join(", ")
          : "휴식";
        return `<p>${label} ${dateLabel(day)} · ${detail}</p>`;
      }).join("")}
    </details>
  `).join("") || `<p class="muted">선택한 월의 기록이 없습니다.</p>`;

  const dayMap = new Map();
  for (const row of monthRecords) {
    if (!dayMap.has(row.workout_date)) dayMap.set(row.workout_date, []);
    dayMap.get(row.workout_date).push(row);
  }
  $("#dailyList").innerHTML = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, rows]) => {
    const total = rows.reduce((sum, row) => sum + Number(row.volume || 0), 0);
    return `
      <details class="day-card">
        <summary>${day} · 총 ${formatKg(total)}</summary>
        ${table(rows)}
      </details>
    `;
  }).join("") || `<p class="muted">선택한 월의 날짜별 기록이 없습니다.</p>`;
}

function renderMonthlyPartChart(monthRecords) {
  const partMap = new Map();
  for (const row of monthRecords) {
    partMap.set(row.body_part, (partMap.get(row.body_part) || 0) + Number(row.volume || 0));
  }

  const chartData = BODY_PARTS.map((part) => [part, partMap.get(part) || 0]).filter(([, value]) => value > 0);
  const max = Math.max(...chartData.map(([, value]) => value), 1);
  const total = monthRecords.reduce((sum, row) => sum + Number(row.volume || 0), 0);
  const totalText = `<p class="muted">${Number(currentMonth.slice(5, 7))}월 · 총볼륨 ${formatKg(total)}</p>`;
  $("#monthlyPartChart").innerHTML = totalText + (chartData.length
    ? chartData.map(([part, value]) => `
        <div class="bar">
          <strong>${part}</strong>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, (value / max) * 100)}%"></div></div>
          <span>${formatKg(value)}</span>
        </div>
      `).join("")
    : `<p class="muted">선택한 월의 기록이 없습니다.</p>`);
}

function renderPartDetail(partRows, selected, day) {
  const rows = partRows.filter((row) => row.workout_date === day).sort(savedOrderSort);
  $("#partDetail").innerHTML = `<h2>${day} ${selected} 운동 상세</h2>${table(rows)}`;
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
    <div class="bar" data-part-day="${day}">
      <strong>${dateLabel(day)}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, (value / max) * 100)}%"></div></div>
      <span>${formatKg(value)}</span>
    </div>
  `).join("");

  renderPartDetail(partRows, selected, daily[0][0]);
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

  $("#bodyPart").addEventListener("change", updateExerciseSuggestions);
  $("#exerciseName").addEventListener("change", loadLatestExerciseSuggestion);
  $("#workoutDate").addEventListener("change", async () => {
    currentMonth = monthOf($("#workoutDate").value);
    await renderTodayRecords();
  });
  $("#addSetButton").addEventListener("click", () => resizeSets(setCount + 1));
  $("#removeSetButton").addEventListener("click", () => resizeSets(setCount - 1));
  $("#cancelEditButton").addEventListener("click", resetForm);
  $("#partFilter").addEventListener("change", renderPartPage);
  let lastPartActionAt = 0;
  let partTouchStart = null;
  const handlePartChartSelect = (event) => {
    if (event.type === "touchend") {
      const touch = event.changedTouches[0];
      const moved = partTouchStart && touch && (
        Math.abs(touch.clientX - partTouchStart.x) > 12 || Math.abs(touch.clientY - partTouchStart.y) > 12
      );
      partTouchStart = null;
      lastPartActionAt = Date.now();
      if (moved) return;
      event.preventDefault();
    } else if (Date.now() - lastPartActionAt < 450) {
      return;
    }
    const bar = event.target.closest("[data-part-day]");
    if (!bar) return;
    const selected = $("#partFilter").value;
    renderPartDetail(recordsCache.filter((row) => row.body_part === selected), selected, bar.dataset.partDay);
  };
  $("#partChart").addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    partTouchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  });
  $("#partChart").addEventListener("click", handlePartChartSelect);
  $("#partChart").addEventListener("touchend", handlePartChartSelect, { passive: false });
  $("#weightUnitLabel").addEventListener("click", () => {
    weightUnit = weightUnit === "kg" ? "lb" : "kg";
    renderSets();
  });
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
  let setTouchStart = null;
  function handleSetAction(event) {
    const target = event.target.closest("button");
    if (!target || !$("#setList").contains(target)) return;

    if (event.type === "touchend") {
      const touch = event.changedTouches[0];
      const moved = setTouchStart && touch && (
        Math.abs(touch.clientX - setTouchStart.x) > 12 || Math.abs(touch.clientY - setTouchStart.y) > 12
      );
      setTouchStart = null;
      lastSetActionAt = Date.now();
      if (moved) return;
      event.preventDefault();
    } else if (Date.now() - lastSetActionAt < 450) {
      return;
    }

    // Commit pending input changes without keeping the mobile keyboard open.
    document.activeElement?.blur();
    if (target.dataset.plusWeight) changeValue(Number(target.dataset.plusWeight), "weight", weightStepKg());
    if (target.dataset.minusWeight) changeValue(Number(target.dataset.minusWeight), "weight", -weightStepKg());
    if (target.dataset.plusReps) changeValue(Number(target.dataset.plusReps), "reps", 1);
    if (target.dataset.minusReps) changeValue(Number(target.dataset.minusReps), "reps", -1);
    if (target.dataset.before) {
      const index = Number(target.dataset.before);
      sets[index] = { ...sets[index - 1] };
      renderSets();
    }
  }

  $("#setList").addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    setTouchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, { passive: true });
  $("#setList").addEventListener("mousedown", (event) => {
    if (event.target.closest("button")) event.preventDefault();
  });
  $("#setList").addEventListener("click", handleSetAction);
  $("#setList").addEventListener("touchend", handleSetAction, { passive: false });

  $("#setList").addEventListener("input", (event) => {
    const target = event.target;
    if (target.dataset.weight) setValue(Number(target.dataset.weight), "weight", weightInputToKg(target.value), false);
    if (target.dataset.reps) setValue(Number(target.dataset.reps), "reps", target.value, false);
  });

  $("#saveWorkoutButton").addEventListener("click", async () => {
    try {
      if (!db && !connectFirebase()) return toast("Firebase 연결에 실패했습니다.");
      const rows = rowsForSave();
      if (!$("#exerciseName").value.trim()) return toast("운동명을 입력해주세요.");
      if (!rows.length) return toast("무게와 횟수가 입력된 세트가 없습니다.");
      if (editTarget) await deleteWorkoutGroup(editTarget);
      await insertWorkoutRows(rows);
      toast(editTarget ? "수정했습니다." : "저장했습니다.");
      resetForm();
      await refreshAll();
      updateExerciseSuggestions();
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
  if (connectFirebase()) {
    try {
      await refreshAll();
      updateExerciseSuggestions();
    } catch (error) {
      toast(error.message || "데이터를 불러오지 못했습니다.");
    }
  }
}

init();
