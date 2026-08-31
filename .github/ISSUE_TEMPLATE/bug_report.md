name: Bug Report
description: Report a bug or issue with Kelime Havuzum
labels: ["bug"]
assignees: []

body:
  - type: markdown
    attributes:
      value: |
        Thank you for reporting a bug! Please provide detailed information to help us fix it.

  - type: input
    id: title
    attributes:
      label: Bug Title
      placeholder: Brief description of the bug
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: Description
      description: Clear description of what's not working
      placeholder: |
        - What were you trying to do?
        - What happened instead?
        - What did you expect to happen?
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: How to reproduce the issue
      placeholder: |
        1. Open the app
        2. Add a word
        3. Try to review
        4. See error
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What should happen instead
    validations:
      required: true

  - type: dropdown
    id: browser
    attributes:
      label: Browser
      options:
        - Chrome
        - Firefox
        - Safari
        - Edge
        - Other
    validations:
      required: true

  - type: input
    id: browser-version
    attributes:
      label: Browser Version
      placeholder: e.g., 120.0

  - type: dropdown
    id: os
    attributes:
      label: Operating System
      options:
        - Windows
        - macOS
        - Linux
        - iOS
        - Android
    validations:
      required: true

  - type: textarea
    id: additional
    attributes:
      label: Additional Information
      description: Any other details (screenshots, error messages, etc.)
      placeholder: Paste error messages or screenshots here

  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      options:
        - label: I have searched for existing issues
          required: true
        - label: This is not a feature request
          required: true
        - label: I have tested in multiple browsers
