"""
Volunteer Entry Form – Streamlit page.
"""
import streamlit as st
from data_utils import add_entry, run_expiry_check

st.set_page_config(
    page_title="Volunteer Entry",
    page_icon="✏️",
    layout="centered",
    initial_sidebar_state="expanded",
)

st.title("Food Rescue – Volunteer Entry")
st.caption("Enter rescued food details. Data appears on the Operations and Warehouse dashboards.")

with st.form("volunteer_entry_form"):
    food_type = st.selectbox(
        "Food type *",
        ["", "Frozen", "Produce", "Dairy", "Bakery", "Canned", "Other"],
        index=0,
    )
    item_name = st.text_input("Item name / description *", placeholder="e.g. Mixed vegetables, Bread rolls")
    qty_col, unit_col = st.columns(2)
    with qty_col:
        quantity = st.number_input("Quantity *", min_value=0.0, step=0.1, value=0.0)
    with unit_col:
        unit = st.selectbox("Unit", ["lbs", "kg", "units", "bags", "boxes"])
    expiry_date = st.date_input("Expiry / use-by date *")
    donor = st.text_input("Donor / source", placeholder="Store or donor name")
    volunteer_name = st.text_input("Your name (volunteer)", placeholder="Optional")
    notes = st.text_area("Notes", placeholder="Storage location, special handling, etc.", height=80)

    submitted = st.form_submit_button("Submit rescue entry")
    if submitted:
        if not food_type or not item_name:
            st.error("Please fill in Food type and Item name.")
        else:
            add_entry(
                food_type=food_type or "Other",
                item_name=item_name,
                quantity=quantity,
                unit=unit,
                expiry_date=expiry_date.isoformat() if expiry_date else None,
                donor=donor,
                volunteer_name=volunteer_name,
                notes=notes,
            )
            st.success("Entry saved. It will appear on the Operations and Warehouse dashboards.")
            # Optionally run expiry check so new near-expiry items get alerted
            run_expiry_check()
