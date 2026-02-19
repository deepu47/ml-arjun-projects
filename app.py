"""
Food Rescue – Operations Dashboard (Streamlit).
Main entry: run with streamlit run app.py
"""
import streamlit as st
from datetime import datetime

from data_utils import (
    read_entries,
    read_alerts,
    get_near_expiry,
    dashboard_stats,
)

st.set_page_config(
    page_title="Food Rescue Operations",
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("Food Rescue Operations")
st.caption(f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

# Metrics
stats = dashboard_stats()
entries = read_entries()
near = get_near_expiry()
alerts_list = read_alerts()

col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Food rescued (7d avg)", f"{stats['foodRescuedLbsPerDay']:,} lbs/day")
with col2:
    st.metric("Spoilage", "2.4%")
with col3:
    st.metric("Total entries", stats["totalEntries"])
with col4:
    st.metric("Near expiry (action needed)", len(near), delta="Frozen & produce within 48h")

st.subheader("Near expiry (Frozen & Produce – within 48 hours)")
if near:
    st.dataframe(
        [
            {
                "Type": e.get("foodType"),
                "Item": e.get("itemName"),
                "Qty": f"{e.get('quantity', 0)} {e.get('unit', '')}",
                "Expiry": e.get("expiryDate"),
                "Donor": e.get("donor"),
            }
            for e in near
        ],
        use_container_width=True,
        hide_index=True,
    )
else:
    st.info("No frozen or produce items expiring within 48 hours.")

st.subheader("Recent rescue entries")
sorted_entries = sorted(entries, key=lambda e: e.get("createdAt") or "", reverse=True)[:50]
if sorted_entries:
    st.dataframe(
        [
            {
                "Type": e.get("foodType"),
                "Item": e.get("itemName"),
                "Qty": f"{e.get('quantity', 0)} {e.get('unit', '')}",
                "Expiry": e.get("expiryDate"),
                "Donor": e.get("donor"),
                "Time": (e.get("createdAt") or "")[:19].replace("T", " "),
            }
            for e in sorted_entries
        ],
        use_container_width=True,
        hide_index=True,
    )
else:
    st.info("No entries yet. Use **Volunteer Entry** in the sidebar to add rescues.")

st.subheader("Recent alerts (sent to supervisor)")
if alerts_list:
    for a in alerts_list[:10]:
        st.text(f"• {a.get('createdAt', '')[:16]} – {a.get('message', '')}")
else:
    st.caption("Alerts run every 2 hours for near-expiry frozen & produce.")
