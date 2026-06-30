from datetime import date

import pandas as pd
import streamlit as st
from supabase import create_client


st.set_page_config(page_title="운동 기록", page_icon="🏋️", layout="centered")


BODY_PARTS = ["가슴", "등", "하체", "어깨", "팔", "복근", "기타"]


def get_supabase():
    url = st.secrets["SUPABASE_URL"]
    key = st.secrets["SUPABASE_KEY"]
    return create_client(url, key)


supabase = get_supabase()


def load_records():
    response = (
        supabase.table("workout_sets")
        .select("*")
        .order("workout_date", desc=True)
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


def show_set_inputs():
    if "set_count" not in st.session_state:
        st.session_state.set_count = 3

    col1, col2 = st.columns(2)
    with col1:
        if st.button("+ 세트 추가", use_container_width=True):
            st.session_state.set_count += 1
    with col2:
        if st.button("- 세트 삭제", use_container_width=True):
            st.session_state.set_count = max(1, st.session_state.set_count - 1)

    header = st.columns([0.8, 1.4, 1.4, 1.4])
    header[0].markdown("")
    header[1].markdown("**무게**")
    header[2].markdown("**횟수**")
    header[3].markdown("**볼륨**")

    sets = []
    total_volume = 0

    for i in range(1, st.session_state.set_count + 1):
        row = st.columns([0.8, 1.4, 1.4, 1.4])
        row[0].markdown(f"**{i}set**")

        weight = row[1].number_input(
            "무게",
            min_value=0.0,
            step=0.5,
            key=f"weight_{i}",
            label_visibility="collapsed",
        )
        reps = row[2].number_input(
            "횟수",
            min_value=0,
            step=1,
            key=f"reps_{i}",
            label_visibility="collapsed",
        )
        volume = weight * reps
        row[3].number_input(
            "볼륨",
            value=float(volume),
            disabled=True,
            key=f"volume_{i}",
            label_visibility="collapsed",
        )

        sets.append({"weight": weight, "reps": reps})
        total_volume += volume

    st.metric("이 운동 총 볼륨", f"{total_volume:,.0f} kg")
    return sets


def today_page():
    st.subheader("오늘 운동 기록")

    workout_date = st.date_input("날짜", value=date.today())
    body_part = st.selectbox("부위", BODY_PARTS)
    exercise_name = st.text_input("운동명", placeholder="예: 벤치프레스")

    sets = show_set_inputs()

    if st.button("운동 저장", type="primary", use_container_width=True):
        if not exercise_name.strip():
            st.warning("운동명을 입력해주세요.")
            return

        saved_count = save_workout(workout_date, body_part, exercise_name, sets)

        if saved_count == 0:
            st.warning("무게와 횟수가 입력된 세트가 없습니다.")
        else:
            st.success(f"{saved_count}세트를 저장했습니다.")


def monthly_page():
    st.subheader("월별 기록")

    records = load_records()
    if records.empty:
        st.info("아직 저장된 기록이 없습니다.")
        return

    records["workout_date"] = pd.to_datetime(records["workout_date"]).dt.date
    records["month"] = records["workout_date"].map(lambda value: value.strftime("%Y-%m"))

    selected_month = st.selectbox("월 선택", sorted(records["month"].unique(), reverse=True))
    month_records = records[records["month"] == selected_month]

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

    st.line_chart(daily.sort_values("workout_date").set_index("workout_date")["volume"])

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


st.title("운동 기록")

tab_today, tab_month, tab_body = st.tabs(["오늘 기록", "월별 기록", "부위별 기록"])

with tab_today:
    today_page()

with tab_month:
    monthly_page()

with tab_body:
    body_part_page()
