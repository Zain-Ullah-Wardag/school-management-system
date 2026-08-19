# Result Calculation Formula

The result engine uses the editable weights stored on each exam. The default school configuration is:

```text
Published Class Tests: 25%
Term Examination:     75%
Passing Percentage:   40%
```

## Per-subject formula

For each subject:

```text
Class Test Raw % = average((test obtained ÷ test total) × 100)
Class Test Contribution = Class Test Raw % × class-test-weight ÷ 100

Exam Raw % = exam obtained ÷ exam total × 100
Exam Contribution = Exam Raw % × exam-weight ÷ 100

Weighted Subject % = Class Test Contribution + Exam Contribution
```

## Subject pass/fail

A subject is **Pass** only when all conditions are true:

1. A term-exam mark has been entered.
2. The raw term-exam percentage meets that subject's passing marks.
3. The weighted subject percentage meets the school passing percentage.

A missing mark, an exam score of `0%`, or a weighted score below the passing percentage is always **Fail**.

## Overall pass/fail

```text
Overall Percentage = average(weighted subject percentages)
```

A student is **Pass** only if:

- At least one exam subject exists;
- Every subject has an entered exam mark;
- Every subject is Pass; and
- Overall Percentage is at least the configured school passing percentage.

This prevents an empty result or `0%` result from ever being labelled PASS.

## Grade and GPA

| Percentage | Grade | GPA |
| ---: | --- | ---: |
| 90–100 | A+ | 4.0 |
| 80–89.99 | A | 3.7 |
| 70–79.99 | B | 3.3 |
| 60–69.99 | C | 3.0 |
| 50–59.99 | D | 2.0 |
| Passing threshold–49.99 | E | 1.0 |
| Below passing threshold | F | 0.0 |
