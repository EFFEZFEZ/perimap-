import csv
import json
import statistics
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta
import argparse

GTFS_DIR = "public/data/gtfs"
LINES = ["A", "B", "C", "D"]


def parse_time_to_minutes(value: str) -> float:
    # GTFS format HH:MM:SS, HH can exceed 24
    h, m, s = value.strip().split(":")
    return int(h) * 60 + int(m) + int(s) / 60.0


def fmt_hhmm(minutes: float) -> str:
    minutes = int(round(minutes))
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}h{m:02d}"


def daytypes_from_service(calendar: dict, service_id: str) -> list[str]:
    flags = calendar.get(service_id)
    if not flags:
        return []

    out: list[str] = []
    if any(flags[d] for d in ["monday", "tuesday", "wednesday", "thursday", "friday"]):
        out.append("weekday")
    if flags["saturday"]:
        out.append("saturday")
    if flags["sunday"]:
        out.append("sunday")
    return out


def parse_yyyymmdd(value: str) -> date:
    return datetime.strptime(value, "%Y%m%d").date()


def format_yyyymmdd(value: date) -> str:
    return value.strftime("%Y%m%d")


def next_weekday(from_date: date) -> date:
    d = from_date
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def next_saturday(from_date: date) -> date:
    d = from_date
    while d.weekday() != 5:
        d += timedelta(days=1)
    return d


def next_sunday(from_date: date) -> date:
    d = from_date
    while d.weekday() != 6:
        d += timedelta(days=1)
    return d


def dow_field(d: date) -> str:
    return [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ][d.weekday()]


@dataclass(frozen=True)
class CalendarService:
    start_date: date
    end_date: date
    flags: dict[str, int]


def is_service_active(
    services: dict[str, CalendarService],
    exceptions: dict[tuple[str, str], int],
    service_id: str,
    d: date,
) -> bool:
    ymd = format_yyyymmdd(d)

    exception_type = exceptions.get((service_id, ymd))
    if exception_type == 1:
        return True
    if exception_type == 2:
        return False

    svc = services.get(service_id)
    if not svc:
        return False
    if d < svc.start_date or d > svc.end_date:
        return False
    return bool(svc.flags.get(dow_field(d), 0))


def safe_quantiles(values: list[float]) -> tuple[float | None, float | None]:
    # returns (p10, p90) if we have enough values for deciles; else (None, None)
    if len(values) < 10:
        return None, None
    deciles = statistics.quantiles(values, n=10)
    return deciles[0], deciles[-1]


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute FAQ schedule/headway summary from GTFS")
    parser.add_argument("--out", help="Write JSON output to this file (UTF-8)")
    args = parser.parse_args()

    # routes
    route_id_by_short: dict[str, str] = {}
    with open(f"{GTFS_DIR}/routes.txt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            short = row.get("route_short_name")
            if short in LINES:
                route_id_by_short[short] = row["route_id"]

    # calendar
    services: dict[str, CalendarService] = {}
    with open(f"{GTFS_DIR}/calendar.txt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            services[row["service_id"]] = CalendarService(
                start_date=parse_yyyymmdd(row["start_date"]),
                end_date=parse_yyyymmdd(row["end_date"]),
                flags={
                    d: int(row[d])
                    for d in [
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                        "saturday",
                        "sunday",
                    ]
                },
            )

    # calendar_dates exceptions: (service_id, date) -> exception_type
    exceptions: dict[tuple[str, str], int] = {}
    with open(f"{GTFS_DIR}/calendar_dates.txt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            exceptions[(row["service_id"], row["date"])] = int(row["exception_type"])

    # stops
    stop_name: dict[str, str] = {}
    with open(f"{GTFS_DIR}/stops.txt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            stop_name[row["stop_id"]] = row.get("stop_name") or row["stop_id"]

    # trips
    trip_meta: dict[str, dict] = {}
    with open(f"{GTFS_DIR}/trips.txt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = row["route_id"]
            line = next((sn for sn, route_id in route_id_by_short.items() if route_id == rid), None)
            if not line:
                continue
            trip_id = row["trip_id"]
            direction_id_raw = row.get("direction_id")
            direction_id = int(direction_id_raw) if direction_id_raw not in (None, "") else 0
            trip_meta[trip_id] = {
                "line": line,
                "service_id": row["service_id"],
                "direction_id": direction_id,
            }

    # stop_times: first departure + first/last stop for each trip
    first_stop_seq: dict[str, int] = {}
    last_stop_seq: dict[str, int] = {}
    first_departure_min: dict[str, float] = {}
    first_stop_id: dict[str, str] = {}
    last_stop_id: dict[str, str] = {}

    with open(f"{GTFS_DIR}/stop_times.txt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            trip_id = row["trip_id"]
            if trip_id not in trip_meta:
                continue

            seq = int(row["stop_sequence"])
            sid = row["stop_id"]

            departure = row.get("departure_time") or row.get("arrival_time")

            if trip_id not in first_stop_seq or seq < first_stop_seq[trip_id]:
                first_stop_seq[trip_id] = seq
                first_stop_id[trip_id] = sid
                if departure:
                    first_departure_min[trip_id] = parse_time_to_minutes(departure)

            if trip_id not in last_stop_seq or seq > last_stop_seq[trip_id]:
                last_stop_seq[trip_id] = seq
                last_stop_id[trip_id] = sid

    summary: dict[str, dict] = {sn: {} for sn in LINES}

    today = date.today()
    d_weekday = next_weekday(today)
    d_saturday = next_saturday(today)
    d_sunday = next_sunday(today)

    day_ref = {
        "weekday": d_weekday,
        "saturday": d_saturday,
        "sunday": d_sunday,
    }

    for line in LINES:
        trips = [
            tid
            for tid, meta in trip_meta.items()
            if meta["line"] == line
            and tid in first_departure_min
            and tid in first_stop_id
            and tid in last_stop_id
        ]

        for dt in ["weekday", "saturday", "sunday"]:
            ref_date = day_ref[dt]
            for direction_id in [0, 1]:
                times: list[float] = []
                firsts: list[str] = []
                lasts: list[str] = []

                for tid in trips:
                    meta = trip_meta[tid]
                    if meta["direction_id"] != direction_id:
                        continue
                    if not is_service_active(services, exceptions, meta["service_id"], ref_date):
                        continue
                    times.append(first_departure_min[tid])
                    firsts.append(first_stop_id[tid])
                    lasts.append(last_stop_id[tid])

                if not times:
                    continue

                times.sort()
                gaps = [times[i + 1] - times[i] for i in range(len(times) - 1)]
                gaps = [g for g in gaps if g > 0.5]  # ignore duplicates

                median = statistics.median(gaps) if gaps else None
                p10, p90 = safe_quantiles(gaps)

                term_from = Counter(firsts).most_common(1)[0][0]
                term_to = Counter(lasts).most_common(1)[0][0]

                summary[line].setdefault(dt, {})[str(direction_id)] = {
                    "ref_date": format_yyyymmdd(ref_date),
                    "start": fmt_hhmm(times[0]),
                    "end": fmt_hhmm(times[-1]),
                    "trips": len(times),
                    "headway": {
                        "median_min": round(median) if median is not None else None,
                        "p10_min": round(p10) if p10 is not None else None,
                        "p90_min": round(p90) if p90 is not None else None,
                    },
                    "terminus_from": stop_name.get(term_from, term_from),
                    "terminus_to": stop_name.get(term_to, term_to),
                }

    payload = json.dumps(summary, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(payload)
    else:
        print(payload)


if __name__ == "__main__":
    main()
