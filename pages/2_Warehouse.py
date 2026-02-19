"""
Warehouse Dashboard – Streamlit page.
"""
import streamlit as st
from datetime import datetime
from collections import defaultdict

from data_utils import read_entries, dashboard_stats

st.set_page_config(
    page_title="Warehouse Dashboard",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("Warehouse Dashboard")
st.caption(f"Updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

entries = read_entries()
stats = dashboard_stats()
total_qty = sum(float(e.get("quantity") or 0) for e in entries)

col1, col2, col3 = st.columns(3)
with col1:
    st.metric("Total items in system", len(entries), "entries")
with col2:
    st.metric("Total quantity", f"{int(total_qty):,}", "lbs")
with col3:
    st.metric("Recent intake (7 days)", stats["recentCount"], "items")

st.subheader("Inventory by category")
by_cat = defaultdict(lambda: {"count": 0, "quantity": 0})
for e in entries:
    cat = e.get("foodType") or "Other"
    by_cat[cat]["count"] += 1
    by_cat[cat]["quantity"] += float(e.get("quantity") or 0)
cats = ["Frozen", "Produce", "Dairy", "Bakery", "Canned", "Other"]
for cat in cats:
    if cat not in by_cat and cat in ["Frozen", "Produce"]:
        by_cat[cat] = {"count": 0, "quantity": 0}
cols = st.columns(len(cats))
for i, cat in enumerate(cats):
    data = by_cat.get(cat, {"count": 0, "quantity": 0})
    with cols[i]:
        st.metric(cat, f"{int(data['quantity']):,}", f"{data['count']} items")

st.subheader("Recent intake (latest first)")
sorted_entries = sorted(entries, key=lambda e: e.get("createdAt") or "", reverse=True)[:30]
if sorted_entries:
    st.dataframe(
        [
            {
                "Type": e.get("foodType"),
                "Item": e.get("itemName"),
                "Qty": f"{e.get('quantity', 0)} {e.get('unit', '')}",
                "Expiry": e.get("expiryDate"),
                "Donor": e.get("donor"),
                "Received": (e.get("createdAt") or "")[:19].replace("T", " "),
            }
            for e in sorted_entries
        ],
        use_container_width=True,
        hide_index=True,
    )
else:
    st.info("No intake yet.")

st.subheader("Full inventory (sorted by expiry)")
by_expiry = sorted(
    entries,
    key=lambda e: e.get("expiryDate") or "9999-99-99",
)
if by_expiry:
    st.dataframe(
        [
            {
                "Type": e.get("foodType"),
                "Item": e.get("itemName"),
                "Qty": f"{e.get('quantity', 0)} {e.get('unit', '')}",
                "Expiry": e.get("expiryDate"),
                "Donor": e.get("donor"),
                "Received": (e.get("createdAt") or "")[:10],
            }
            for e in by_expiry
        ],
        use_container_width=True,
        hide_index=True,
    )
else:
    st.info("No inventory.")
