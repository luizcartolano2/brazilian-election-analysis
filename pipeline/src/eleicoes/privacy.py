"""Keeps candidates' personal identifiers out of outputs, fixtures and logs."""

import re
from collections.abc import Iterable

DENIED_COLUMN_FRAGMENTS = ("CPF", "TITULO", "EMAIL", "NASCIMENTO")

CPF_CANDIDATE = re.compile(r"(?<!\d)\d{11}(?!\d)")


class PersonalDataError(Exception):
    pass


def assert_no_personal_columns(table: str, columns: Iterable[str]) -> None:
    for column in columns:
        if any(fragment in column.upper() for fragment in DENIED_COLUMN_FRAGMENTS):
            raise PersonalDataError(f"{table} would contain the personal column {column}")


def is_valid_cpf(digits: str) -> bool:
    if len(digits) != 11 or not digits.isdigit() or len(set(digits)) == 1:
        return False
    for length in (9, 10):
        total = sum(
            int(digit) * weight
            for digit, weight in zip(digits[:length], range(length + 1, 1, -1), strict=True)
        )
        check = (total * 10) % 11 % 10
        if check != int(digits[length]):
            return False
    return True


def valid_cpfs_in(text: str) -> list[str]:
    return [match for match in CPF_CANDIDATE.findall(text) if is_valid_cpf(match)]
