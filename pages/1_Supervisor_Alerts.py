"""
Supervisor Alert Board – Streamlit page.
"""
import streamlit as st
from datetime import datetime

from data_utils import read_alerts, get_near_expiry

st.set_page_config(
    page_title="Supervisor Alerts",
    page_icon="⚠️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("Supervisor Alert Board")
st.caption(f"Updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

near = get_near_expiry()
frozen_count = sum(1 for e in near if (e.get("foodType") or "").lower() == "frozen")
produce_count = sum(1 for e in near if (e.get("foodType") or "").lower() == "produce")

col1, col2, col3 = st.columns(3)
with col1:
    st.metric("Items needing action", len(near), "Frozen & produce within 48h")
with col2:
    st.metric("Frozen", frozen_count)
with col3:
    st.metric("Produce", produce_count)

filter_type = st.radio("Show", ["All", "Frozen", "Produce"], horizontal=True)
filtered = (
    near
    if filter_type == "All"
    else [e for e in near if (e.get("foodType") or "").lower() == filter_type.lower()]
)

st.subheader("Alert items")
if filtered:
    for e in filtered:
        with st.expander(f"{e.get('foodType')} – {e.get('itemName')} (expires {e.get('expiryDate')})"):
            st.write(f"**Quantity:** {e.get('quantity')} {e.get('unit')}")
            st.write(f"**Donor:** {e.get('donor') or '—'}")
else:
    st.info("No items needing action in this category.")

st.subheader("Alert history (sent to supervisor)")
alerts = read_alerts()
if alerts:
    st.dataframe(
        [
            {
                "Time": (a.get("createdAt") or "")[:19].replace("T", " "),
                "Type": a.get("foodType"),
                "Item": a.get("itemName"),
                "Qty": f"{a.get('quantity', '')} {a.get('unit', '')}",
                "Expiry": a.get("expiryDate"),
                "Donor": a.get("donor"),
            }
            for a in alerts[:50]
        ],
        use_container_width=True,
        hide_index=True,
    )
else:
    st.caption("Alerts are generated every 2 hours.")
