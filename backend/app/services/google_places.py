\
import requests
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GOOGLE_API_KEY")


def get_place_details(place_id: str):

    url = (
        "https://maps.googleapis.com/maps/api/place/details/json"
        f"?place_id={place_id}"
        "&fields=name,formatted_phone_number,website,formatted_address"
        f"&key={API_KEY}"
    )

    response = requests.get(url)

    data = response.json()

    result = data.get("result", {})

    return {
        "business_name": result.get("name"),
        "phone": result.get("formatted_phone_number"),
        "website": result.get("website"),
        "address": result.get("formatted_address")
    }


def search_places(query: str):

    url = (
        "https://maps.googleapis.com/maps/api/place/textsearch/json"
        f"?query={query}"
        f"&key={API_KEY}"
    )

    response = requests.get(url)

    data = response.json()

    leads = []

    for place in data.get("results", []):

        place_id = place.get("place_id")

        if not place_id:
            continue

        try:
            details = get_place_details(place_id)
            leads.append(details)

        except Exception as e:
            print(f"Error processing place: {e}")

    return leads


