# CSV to JSON Converter CLI

A simple command-line tool to convert CSV files to JSON.

## Requirements

- Python 3.8+

## Usage

From the project directory:

```bash
python csv_to_json.py input.csv -o output.json
```

If you omit `-o/--output`, the JSON will be written to stdout:

```bash
python csv_to_json.py input.csv
```

You can also control JSON indentation (default is 2 spaces):

```bash
python csv_to_json.py input.csv -o output.json --indent 4
```
