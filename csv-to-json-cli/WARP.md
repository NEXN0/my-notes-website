# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Environment & Requirements

- Python 3.8+ is required (see `README.md`).
- The project is a single-file CLI tool with no external Python dependencies beyond the standard library.

## Common Commands

From the project root (`/Users/tang/csv-to-json-cli`):

- Convert a CSV file to JSON and write to a file:

  ```bash
  python csv_to_json.py input.csv -o output.json
  ```

- Convert a CSV file to JSON and write to stdout:

  ```bash
  python csv_to_json.py input.csv
  ```

- Control JSON indentation (default is 2 spaces):

  ```bash
  python csv_to_json.py input.csv -o output.json --indent 4
  ```

There is currently no dedicated build, lint, or test tooling configured; development is done by running `csv_to_json.py` directly with Python.

## Code Structure & Architecture

### Overview

The core logic lives in a single script: `csv_to_json.py`. It implements a small, focused CLI that:

- Parses command-line arguments (input path, optional output path, and JSON indentation).
- Validates that the input CSV file exists.
- Reads the CSV using `csv.DictReader` into a list of row dictionaries.
- Serializes the rows to JSON using `json.dump`, writing either to stdout or to an output file.

### Key Functions in `csv_to_json.py`

- `parse_args() -> argparse.Namespace`
  - Configures the CLI interface (positional `input`, optional `-o/--output`, and `--indent`).
  - Returns parsed arguments for use in `main()`.

- `open_output(path: str | None) -> TextIO`
  - Abstracts where JSON is written.
  - Returns `sys.stdout` when `path` is `None` or `"-"`; otherwise opens the given path for writing with UTF-8 encoding.

- `csv_to_json(input_path: str, output: TextIO, indent: int = 2) -> None`
  - Validates that `input_path` points to an existing file using `pathlib.Path`.
  - Uses `csv.DictReader` to read the CSV into a list of dictionaries.
  - Uses `json.dump` with `ensure_ascii=False` and the provided `indent` to write JSON to the given `output` stream.
  - Writes a trailing newline when writing to a file (non-stdout) for nicer CLI ergonomics.

- `main() -> None`
  - Orchestrates the CLI flow: parses args, opens the appropriate output stream with `open_output`, then calls `csv_to_json`.

### Error Handling & I/O Behavior

- If the input file does not exist, `csv_to_json` raises `SystemExit` with a clear error message including the missing path.
- When writing to stdout, the script does not append an extra newline beyond what `json.dump` produces; when writing to a file, it appends a newline after the JSON for readability.

This structure keeps command-line parsing, file handling, and conversion logic cleanly separated, which should be preserved if you extend the tool (for example, by adding more CLI flags or supporting alternate output formats).