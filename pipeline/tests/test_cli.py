from conftest import FIXTURES, Tse

from eleicoes.cli import main


def arguments(tse: Tse, tmp_path, *extra: str) -> list[str]:
    bases = tse.publish()
    return [
        "build", "--round", "1", "--out", str(tmp_path / "out"), "--work", str(tmp_path / "work"),
        "--cache", str(tmp_path / "cache"), "--commit", "test",
        "--cdn-base", bases.cdn, "--results-base", bases.results, *extra,
    ]  # fmt: skip


def test_a_successful_build_exits_with_zero(tse, tmp_path):
    assert main(arguments(tse, tmp_path, "--states", "ac")) == 0
    assert (tmp_path / "out" / "manifest.json").exists()


def test_an_expected_failure_exits_with_one_and_writes_nothing(tse, tmp_path):
    assert main(arguments(tse, tmp_path, "--states", "XX")) == 1
    assert not (tmp_path / "out").exists()


def test_fixtures_are_where_the_cli_tests_expect_them():
    assert (FIXTURES / "results").is_dir()
