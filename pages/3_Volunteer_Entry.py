"""
Volunteer Entry Form – Streamlit page.
Accepts multiple food items in one submission.
"""
import streamlit as st
from data_utils import add_entries_batch, run_expiry_check

st.set_page_config(
    page_title="Volunteer Entry",
    page_icon="✏️",
    layout="centered",
    initial_sidebar_state="expanded",
)

st.title("Food Rescue – Volunteer Entry")
st.caption("Enter one or more rescued food items. Add multiple items below, then submit once.")

# Shared fields
st.subheader("Shared (applies to all items)")
default_donor = st.text_input("Donor / source (optional)", placeholder="Store or donor name", key="donor")
volunteer_name = st.text_input("Your name (volunteer, optional)", placeholder="Optional", key="volunteer")

# Number of items
st.subheader("Food items")
num_items = st.number_input(
    "How many items are you entering?",
    min_value=1,
    max_value=25,
    value=1,
    step=1,
    key="num_items",
)

# Collect item fields
items = []
for i in range(int(num_items)):
    st.markdown(f"**Item {i + 1}**")
    col1, col2 = st.columns(2)
    with col1:
        food_type = st.selectbox(
            "Food type *",
            ["", "Frozen", "Produce", "Dairy", "Bakery", "Canned", "Other"],
            index=0,
            key=f"food_type_{i}",
        )
        quantity = st.number_input("Quantity *", min_value=0.0, step=0.1, value=0.0, key=f"qty_{i}")
        expiry_date = st.date_input("Expiry / use-by date *", key=f"expiry_{i}")
    with col2:
        item_name = st.text_input(
            "Item name / description *",
            placeholder="e.g. Mixed vegetables, Bread rolls",
            key=f"item_name_{i}",
        )
        unit = st.selectbox("Unit", ["lbs", "kg", "units", "bags", "boxes"], key=f"unit_{i}")
        donor_override = st.text_input("Donor for this item (blank = use shared)", key=f"donor_{i}")
    notes = st.text_input("Notes (optional)", key=f"notes_{i}")
    items.append({
        "foodType": food_type or "Other",
        "itemName": item_name,
        "quantity": quantity,
        "unit": unit,
        "expiryDate": expiry_date.isoformat() if expiry_date else None,
        "donor": donor_override if donor_override else None,
        "notes": notes,
    })
    st.divider()

submitted = st.button("Submit all items")
if submitted:
    valid = [it for it in items if it["itemName"] and (it["foodType"] or "").strip()]
    if not valid:
        st.error("Please fill in at least one item with Food type and Item name.")
    else:
        created = add_entries_batch(
            valid,
            volunteer_name=volunteer_name or "",
            default_donor=default_donor or "",
        )
        run_expiry_check()
        st.success(f"{len(created)} item(s) saved. They will appear on the Operations and Warehouse dashboards.")
