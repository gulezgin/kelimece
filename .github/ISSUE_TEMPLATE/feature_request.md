name: Feature Request
description: Suggest a new feature or enhancement
labels: ["enhancement"]
assignees: []

body:
  - type: markdown
    attributes:
      value: |
        ## Feature Request

        Thank you for suggesting an improvement to Kelimece!

  - type: input
    id: title
    attributes:
      label: Feature Title
      placeholder: Brief title of the feature
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: Description
      description: Detailed description of the feature
      placeholder: |
        - What problem does this solve?
        - How would users benefit?
        - How would this work?
    validations:
      required: true

  - type: textarea
    id: use-case
    attributes:
      label: Use Case
      description: Explain the use case and why this feature is needed
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: What alternatives have you considered?

  - type: dropdown
    id: priority
    attributes:
      label: Priority
      options:
        - Low
        - Medium
        - High
    validations:
      required: true

  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      options:
        - label: I have checked existing issues/discussions
          required: true
        - label: This is not a bug report
          required: true
