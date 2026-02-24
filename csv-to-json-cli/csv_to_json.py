#!/usr/bin/env python3
"""Simple CSV to JSON converter CLI.

Usage:
  python csv_to_json.py input.csv [-o output.json]

If -o/--output is not provided, JSON is written to stdout.
"""
import argparse
import csv
import json
import sys
from pathlib import Path
from typing import TextIO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert a CSV file to JSON.",
    )
    parser.add_argument(
        "input",
        help="Path to the input CSV file.",
    )
    parser.add_argument(
        "-o",
        "--output",
        help="Path to the output JSON file. Defaults to stdout if omitted.",
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="Number of spaces to use for JSON indentation (default: 2).",
    )
    return parser.parse_args()


def open_output(path: str | None) -> TextIO:
    if path is None or path == "-":
        return sys.stdout
    return open(path, "w", encoding="utf-8")


def csv_to_json(input_path: str, output: TextIO, indent: int = 2) -> None:
    csv_path = Path(input_path)
    if not csv_path.is_file():
        raise SystemExit(f"Input file not found: {csv_path}")

    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    json.dump(rows, output, indent=indent, ensure_ascii=False)
    if output is not sys.stdout:
        output.write("\n")


def main() -> None:
    args = parse_args()
    with open_output(args.output) as out:
        csv_to_json(args.input, out, indent=args.indent)


if __name__ == "__main__":
    main()
