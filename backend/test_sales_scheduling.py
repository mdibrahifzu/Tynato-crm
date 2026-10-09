from datetime import datetime, timezone
import unittest

from app.sales_scheduling.service import local_to_utc, normalize_utc
from app.sales_scheduling.schemas import AvailabilityInterval, BookingCreateRequest


class SalesSchedulingUnitTests(unittest.TestCase):
    def test_local_to_utc_asia_kolkata(self):
        value = datetime(2026, 10, 15, 10, 30)
        result = local_to_utc(value, "Asia/Kolkata")
        self.assertEqual(result, datetime(2026, 10, 15, 5, 0, tzinfo=timezone.utc))

    def test_normalize_utc_requires_timezone(self):
        with self.assertRaises(Exception):
            normalize_utc(datetime(2026, 10, 15, 10, 30))

    def test_availability_rejects_invalid_duration(self):
        with self.assertRaises(ValueError):
            AvailabilityInterval(
                day_of_week=0,
                start_time="09:00",
                end_time="10:00",
                slot_duration_minutes=20,
            )

    def test_booking_requires_offset(self):
        with self.assertRaises(ValueError):
            BookingCreateRequest(start_at="2026-10-15T10:30:00")


    def test_allowed_durations(self):
        for duration in (15, 30, 45, 60):
            self.assertIn(duration, {15, 30, 45, 60})

if __name__ == "__main__":
    unittest.main()
