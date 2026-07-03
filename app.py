from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import altair as alt
import pandas as pd
import streamlit as st
from supabase import create_client


KOREA_TZ = ZoneInfo("Asia/Seoul")


def korea_today():
    return datetime.now(KOREA_TZ).date()


st.set_page_config(page_title="운동 기록", page_icon="🏋️", layout="centered")

st.markdown(
    """
    <style>
    .volume-box {
        min-height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 12px;
        border: 1px solid rgba(250, 250, 250, 0.2);
        border-radius: 8px;
        background: rgba(250, 250, 250, 0.06);
        color: rgba(250, 250, 250, 0.78);
        font-size: 14px;
    }

    .set-title {
        margin: 0.9rem 0 0.25rem;
        font-weight: 700;
    }

    .set-title-inline {
        min-height: 38px;
        display: flex;
        align-items: center;
        font-weight: 700;
    }

    @media (max-width: 640px) {
        .block-container {
            padding-left: 0.65rem;
            padding-right: 0.65rem;
        }

        [data-testid="stHorizontalBlock"] {
            gap: 0.28rem;
            width: 100%;
            max-width: 100%;
        }

        [data-testid="column"] {
            min-width: 0;
            flex: 1 1 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
        }

        [data-testid="stNumberInput"] input {
            font-size: 0.82rem;
            text-align: center;
            padding-left: 0.2rem;
            padding-right: 0.2rem;
        }

        [data-testid="stNumberInput"] button {
            width: 1.45rem;
            min-width: 1.45rem;
            padding-left: 0;
            padding-right: 0;
        }

        .volume-box {
            min-height: 38px;
            padding: 0 0.2rem;
            font-size: 0.78rem;
            white-space: nowrap;
        }
    }
    </style>
    """,
    unsafe_allow_html=True,
)


BODY_PARTS = ["가슴", "등", "하체", "어깨", "팔", "복근", "기타"]
USERS = [
    {
        "id": "daeyeon",
        "name": "대연",
    }
] + [{"id": f"user{i}", "name": f"사용자 {i}"} for i in range(1, 11)]


def get_supabase():
    url = st.secrets["SUPABASE_URL"]
    key = st.secrets["SUPABASE_KEY"]
    return create_client(url, key)


supabase = get_supabase()


def current_user_id():
    return st.session_state.get("user_id")


def current_user_name():
    return st.session_state.get("user_name", "")


def login_page():
    st.title("운동 기록")
    st.markdown("## 지민이 최고")
    st.subheader("사용자 선택")

    user_names = [user["name"] for user in USERS]
    selected_name = st.selectbox("사용자", user_names)

    if st.button("입장", type="primary", use_container_width=True):
        selected_user = next(user for user in USERS if user["name"] == selected_name)
        st.session_state.user_id = selected_user["id"]
        st.session_state.user_name = selected_user["name"]
        st.rerun()


def require_login():
    if not current_user_id():
        login_page()
        st.stop()


def load_records():
    response = (
        supabase.table("workout_sets")
        .select("*")
        .eq("user_id", current_user_id())
        .order("workout_date", desc=True)
        .order("exercise_name")
        .order("set_no")
        .execute()
    )
    return pd.DataFrame(response.data or [])


def load_records_for_date(workout_date):
    response = (
        supabase.table("workout_sets")
        .select("*")
        .eq("user_id", current_user_id())
        .eq("workout_date", workout_date.isoformat())
        .order("created_at", desc=True)
        .order("exercise_name")
        .order("set_no")
        .execute()
    )
    return pd.DataFrame(response.data or [])


def save_workout(workout_date, body_part, exercise_name, sets):
    rows = []

    for set_no, item in enumerate(sets, start=1):
        weight = item.get("weight", 0)
        reps = item.get("reps", 0)
        volume = weight * reps

        if weight <= 0 or reps <= 0:
            continue

        rows.append(
            {
                "user_id": current_user_id(),
                "workout_date": workout_date.isoformat(),
                "body_part": body_part,
                "exercise_name": exercise_name.strip(),
                "set_no": set_no,
                "weight": weight,
                "reps": reps,
                "volume": volume,
            }
        )

    if not rows:
        return 0

    supabase.table("workout_sets").insert(rows).execute()
    return len(rows)


def delete_workout_group(workout_date, body_part, exercise_name):
    (
        supabase.table("workout_sets")
        .delete()
        .eq("user_id", current_user_id())
        .eq("workout_date", workout_date.isoformat())
        .eq("body_part", body_part)
        .eq("exercise_name", exercise_name)
        .execute()
    )


def show_set_inputs():
    if "set_count" not in st.session_state:
        st.session_state.set_count = 4

    set_cols = st.columns([1, 1, 1.2])
    if set_cols[0].button("set ▲", use_container_width=True):
        st.session_state.set_count = min(30, st.session_state.set_count + 1)
        st.rerun()
    if set_cols[1].button("set ▼", use_container_width=True):
        st.session_state.set_count = max(1, st.session_state.set_count - 1)
        st.rerun()
    set_cols[2].markdown(f"**{st.session_state.set_count}set**")

    sets = []
    total_volume = 0

    for i in range(1, st.session_state.set_count + 1):
        if i == 1:
            header_cols = st.columns([1, 1, 1])
            header_cols[0].caption("무게(kg)")
            header_cols[1].caption("횟수")
            header_cols[2].caption("볼륨")

        title_cols = st.columns([1, 1])
        title_cols[0].markdown(
            f'<div class="set-title-inline">{i}set</div>',
            unsafe_allow_html=True,
        )

        if i > 1:
            if title_cols[1].button("Before =", key=f"copy_before_{i}", use_container_width=True):
                st.session_state[f"weight_{i}"] = st.session_state.get(f"weight_{i - 1}", 0.0)
                st.session_state[f"reps_{i}"] = st.session_state.get(f"reps_{i - 1}", 0)
                st.rerun()

        input_cols = st.columns([1, 1, 1])
        weight = input_cols[0].number_input(
            "무게(kg)",
            min_value=0.0,
            step=5.0,
            format="%.0f",
            key=f"weight_{i}",
            label_visibility="collapsed",
        )
        reps = input_cols[1].number_input(
            "횟수",
            min_value=0,
            step=1,
            key=f"reps_{i}",
            label_visibility="collapsed",
        )
        volume = weight * reps
        input_cols[2].markdown(
            f"""
            <div class="volume-box">
                {volume:,.0f}kg
            </div>
            """,
            unsafe_allow_html=True,
        )

        sets.append({"weight": weight, "reps": reps})
        total_volume += volume

    st.metric("이 운동 총 볼륨", f"{total_volume:,.0f} kg")
    return sets


def reset_workout_form():
    st.session_state.set_count = 4
    st.session_state.exercise_name = ""
    st.session_state.edit_mode = False
    st.session_state.edit_original_date = None
    st.session_state.edit_original_body_part = None
    st.session_state.edit_original_exercise_name = None

    for i in range(1, 31):
        st.session_state[f"weight_{i}"] = 0.0
        st.session_state[f"reps_{i}"] = 0


def load_workout_group_into_form(workout_date, body_part, exercise_name, records):
    group = records[
        (records["workout_date"] == workout_date)
        & (records["body_part"] == body_part)
        & (records["exercise_name"] == exercise_name)
    ].sort_values("set_no")

    st.session_state.workout_date = workout_date
    st.session_state.body_part = body_part
    st.session_state.exercise_name = exercise_name
    st.session_state.set_count = max(4, min(30, int(group["set_no"].max())))
    st.session_state.edit_mode = True
    st.session_state.edit_original_date = workout_date
    st.session_state.edit_original_body_part = body_part
    st.session_state.edit_original_exercise_name = exercise_name

    for i in range(1, 31):
        st.session_state[f"weight_{i}"] = 0.0
        st.session_state[f"reps_{i}"] = 0

    for _, row in group.iterrows():
        set_no = int(row["set_no"])
        st.session_state[f"weight_{set_no}"] = float(row["weight"])
        st.session_state[f"reps_{set_no}"] = int(row["reps"])


def show_date_records(workout_date):
    st.markdown("### 오늘 저장 기록")

    records = load_records_for_date(workout_date)
    if records.empty:
        st.info("아직 오늘 저장된 기록이 없습니다.")
        return

    total = records["volume"].sum()
    st.metric("오늘 총 볼륨", f"{total:,.0f} kg")

    summary = (
        records.groupby(["body_part", "exercise_name"], as_index=False)["volume"]
        .sum()
        .sort_values("volume", ascending=False)
    )
    for _, row in summary.iterrows():
        item_cols = st.columns([1.2, 1.8, 1.2, 0.9])
        item_cols[0].markdown(f"**{row['body_part']}**")
        item_cols[1].markdown(row["exercise_name"])
        item_cols[2].markdown(f"{row['volume']:,.0f}kg")
        if item_cols[3].button("수정", key=f"edit_{workout_date}_{row['body_part']}_{row['exercise_name']}"):
            st.session_state.pending_edit = {
                "workout_date": workout_date.isoformat(),
                "body_part": row["body_part"],
                "exercise_name": row["exercise_name"],
            }
            st.rerun()

    with st.expander("세트별 상세"):
        st.dataframe(
            records[["body_part", "exercise_name", "set_no", "weight", "reps", "volume"]]
            .rename(
                columns={
                    "body_part": "부위",
                    "exercise_name": "운동명",
                    "set_no": "세트",
                    "weight": "무게",
                    "reps": "횟수",
                    "volume": "볼륨",
                }
            ),
            use_container_width=True,
            hide_index=True,
        )


def today_page():
    if st.session_state.pop("reset_workout_form", False):
        reset_workout_form()

    pending_edit = st.session_state.pop("pending_edit", None)
    if pending_edit:
        edit_date = date.fromisoformat(pending_edit["workout_date"])
        edit_records = load_records_for_date(edit_date)
        edit_records["workout_date"] = pd.to_datetime(edit_records["workout_date"]).dt.date
        load_workout_group_into_form(
            edit_date,
            pending_edit["body_part"],
            pending_edit["exercise_name"],
            edit_records,
        )

    if "save_message" in st.session_state:
        st.success(st.session_state.pop("save_message"))

    today = korea_today()
    if not st.session_state.get("edit_mode", False):
        last_access_day = st.session_state.get("workout_date_access_day")
        if last_access_day != today:
            st.session_state.workout_date = today
            st.session_state.workout_date_access_day = today

    st.subheader("오늘 운동 기록")

    workout_date = st.date_input("날짜", value=today, key="workout_date")
    body_part = st.selectbox("부위", BODY_PARTS, key="body_part")
    exercise_name = st.text_input("운동명", placeholder="예: 벤치프레스", key="exercise_name")

    sets = show_set_inputs()

    is_editing = st.session_state.get("edit_mode", False)
    if is_editing:
        st.info("수정 중입니다. 저장하면 기존 기록이 현재 입력값으로 교체됩니다.")
        if st.button("수정 취소", use_container_width=True):
            reset_workout_form()
            st.rerun()

    save_label = "수정 저장" if is_editing else "운동 저장"
    if st.button(save_label, type="primary", use_container_width=True):
        if not exercise_name.strip():
            st.warning("운동명을 입력해주세요.")
            return

        if not any(item.get("weight", 0) > 0 and item.get("reps", 0) > 0 for item in sets):
            st.warning("무게와 횟수가 입력된 세트가 없습니다.")
            return

        if is_editing:
            delete_workout_group(
                st.session_state.edit_original_date,
                st.session_state.edit_original_body_part,
                st.session_state.edit_original_exercise_name,
            )

        saved_count = save_workout(workout_date, body_part, exercise_name, sets)

        if saved_count == 0:
            st.warning("무게와 횟수가 입력된 세트가 없습니다.")
        else:
            st.session_state.save_message = (
                f"{saved_count}세트로 수정했습니다." if is_editing else f"{saved_count}세트를 저장했습니다."
            )
            st.session_state.reset_workout_form = True
            st.rerun()

    show_date_records(workout_date)


def monthly_page():
    st.subheader("월별 기록")

    records = load_records()
    if records.empty:
        st.info("아직 저장된 기록이 없습니다.")
        return

    records["workout_date"] = pd.to_datetime(records["workout_date"]).dt.date
    records["month"] = records["workout_date"].map(lambda value: value.strftime("%Y-%m"))

    month_options = sorted(records["month"].unique(), reverse=True)
    if "selected_month_select" not in st.session_state or st.session_state.selected_month_select not in month_options:
        st.session_state.selected_month_select = month_options[0]

    month_index = month_options.index(st.session_state.selected_month_select)
    nav_cols = st.columns([1, 1.2, 1])
    if nav_cols[0].button("◀ 이전 달", use_container_width=True) and month_index < len(month_options) - 1:
        st.session_state.selected_month_select = month_options[month_index + 1]
        st.rerun()
    nav_cols[1].markdown(f"**{st.session_state.selected_month_select}**")
    if nav_cols[2].button("다음 달 ▶", use_container_width=True) and month_index > 0:
        st.session_state.selected_month_select = month_options[month_index - 1]
        st.rerun()

    selected_month = st.selectbox(
        "월 선택",
        month_options,
        index=month_options.index(st.session_state.selected_month_select),
        key="selected_month_select",
    )
    month_records = records[records["month"] == selected_month]

    month_start = pd.to_datetime(f"{selected_month}-01").date()
    month_end = (pd.Timestamp(month_start) + pd.offsets.MonthEnd(0)).date()

    weekly_records = records.copy()
    weekly_records["week_start"] = weekly_records["workout_date"].map(
        lambda value: value - timedelta(days=value.weekday())
    )
    weekly_records["week_end"] = weekly_records["week_start"].map(
        lambda value: value + timedelta(days=6)
    )
    weekly_records = weekly_records[
        (weekly_records["week_start"] <= month_end)
        & (weekly_records["week_end"] >= month_start)
    ]

    st.markdown("### 주간 기록")
    if weekly_records.empty:
        st.info("선택한 월의 주간 기록이 없습니다.")
    else:
        weekdays = ["월", "화", "수", "목", "금", "토", "일"]
        weekly_summary = (
            weekly_records.groupby(["week_start", "week_end"], as_index=False)["volume"]
            .sum()
            .sort_values("week_start")
        )

        for _, week in weekly_summary.iterrows():
            week_start = week["week_start"]
            week_end = week["week_end"]
            week_total = week["volume"]
            label = f"{week_start.month}/{week_start.day} ~ {week_end.month}/{week_end.day} · {week_total:,.0f}kg"

            with st.expander(label):
                rows = []
                week_detail = weekly_records[
                    (weekly_records["week_start"] == week_start)
                    & (weekly_records["week_end"] == week_end)
                ]
                daily_total = week_detail.groupby("workout_date")["volume"].sum().to_dict()

                for day_offset, weekday in enumerate(weekdays):
                    current_day = week_start + timedelta(days=day_offset)
                    volume = daily_total.get(current_day, 0)
                    rows.append(
                        {
                            "요일": weekday,
                            "날짜": current_day.strftime("%m/%d"),
                            "볼륨": f"{volume:,.0f}kg" if volume else "휴식",
                        }
                    )

                st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    st.markdown("### 날짜별 기록")

    daily = (
        month_records.groupby(["workout_date", "body_part"], as_index=False)["volume"]
        .sum()
        .sort_values("workout_date", ascending=False)
    )

    for workout_date, date_group in daily.groupby("workout_date", sort=False):
        total = date_group["volume"].sum()
        with st.expander(f"{workout_date} · 총 {total:,.0f} kg"):
            st.dataframe(
                date_group[["body_part", "volume"]].rename(
                    columns={"body_part": "부위", "volume": "볼륨"}
                ),
                use_container_width=True,
                hide_index=True,
            )

            detail = month_records[month_records["workout_date"] == workout_date]
            st.dataframe(
                detail[["body_part", "exercise_name", "set_no", "weight", "reps", "volume"]]
                .rename(
                    columns={
                        "body_part": "부위",
                        "exercise_name": "운동명",
                        "set_no": "세트",
                        "weight": "무게",
                        "reps": "횟수",
                        "volume": "볼륨",
                    }
                ),
                use_container_width=True,
                hide_index=True,
            )


def body_part_page():
    st.subheader("부위별 기록")

    records = load_records()
    if records.empty:
        st.info("아직 저장된 기록이 없습니다.")
        return

    records["workout_date"] = pd.to_datetime(records["workout_date"]).dt.date

    selected_part = st.selectbox("부위 선택", BODY_PARTS)
    part_records = records[records["body_part"] == selected_part]

    if part_records.empty:
        st.info(f"{selected_part} 기록이 없습니다.")
        return

    daily = (
        part_records.groupby("workout_date", as_index=False)["volume"]
        .sum()
        .sort_values("workout_date", ascending=False)
    )

    recent = daily.head(6).copy()
    st.dataframe(
        recent.rename(columns={"workout_date": "날짜", "volume": "총 볼륨"}),
        use_container_width=True,
        hide_index=True,
    )

    if len(recent) >= 2:
        latest = recent.iloc[0]["volume"]
        previous = recent.iloc[1]["volume"]
        diff = latest - previous
        st.metric("직전 운동 대비", f"{diff:+,.0f} kg")

    chart_data = daily.sort_values("workout_date").tail(8).copy()
    chart_data["날짜"] = chart_data["workout_date"].map(lambda value: value.strftime("%m/%d"))
    chart_data["표시값"] = chart_data["volume"].map(lambda value: f"{value:,.0f}")

    bars = (
        alt.Chart(chart_data)
        .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
        .encode(
            x=alt.X("날짜:N", title=None, sort=None),
            y=alt.Y("volume:Q", title="볼륨"),
            tooltip=[
                alt.Tooltip("날짜:N", title="날짜"),
                alt.Tooltip("volume:Q", title="볼륨", format=",.0f"),
            ],
        )
    )
    labels = (
        alt.Chart(chart_data)
        .mark_text(dy=-8, fontSize=12)
        .encode(
            x=alt.X("날짜:N", sort=None),
            y=alt.Y("volume:Q"),
            text="표시값:N",
        )
    )
    st.altair_chart((bars + labels).properties(height=260), use_container_width=True)

    latest_date = daily.iloc[0]["workout_date"]
    st.markdown(f"**최근 {selected_part} 운동 상세 · {latest_date}**")
    latest_records = part_records[part_records["workout_date"] == latest_date]
    summary = (
        latest_records.groupby("exercise_name", as_index=False)["volume"]
        .sum()
        .sort_values("volume", ascending=False)
    )
    st.dataframe(
        summary.rename(columns={"exercise_name": "운동명", "volume": "볼륨"}),
        use_container_width=True,
        hide_index=True,
    )


require_login()

header_cols = st.columns([1, 0.35])
header_cols[0].title("운동 기록")
header_cols[0].caption(f"{current_user_name()} 기록")
if header_cols[1].button("로그아웃", use_container_width=True):
    for key in ["user_id", "user_name"]:
        st.session_state.pop(key, None)
    reset_workout_form()
    st.rerun()

tab_today, tab_month, tab_body = st.tabs(["오늘 기록", "월별 기록", "부위별 기록"])

with tab_today:
    today_page()

with tab_month:
    monthly_page()

with tab_body:
    body_part_page()
