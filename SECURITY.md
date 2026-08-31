# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Kelime Havuzum, please report it by emailing [security@example.com](mailto:security@example.com) instead of using the issue tracker.

Please include the following details:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if applicable)

We appreciate your responsible disclosure and will make every effort to acknowledge your contribution.

## Security Notes

Since Kelime Havuzum is a client-side application with no backend:

- ✅ Your data is stored only in your browser's localStorage
- ✅ No data is sent to any external server
- ✅ No database vulnerabilities to exploit
- ✅ Import/export only handles JSON files you provide

However, be aware:
- ⚠️ Clear your browser cache/history to completely remove data
- ⚠️ Anyone with access to your device can access your localStorage data
- ⚠️ Browser localStorage is vulnerable to XSS attacks (though unlikely in this static app)
- ⚠️ Always keep your browser updated for security patches

## Best Practices

1. **Backup Regularly** - Export your vocabulary regularly as JSON
2. **Keep Browser Updated** - Ensure your browser has the latest security patches
3. **Use Trusted Devices** - Avoid using untrusted computers to access your vocabulary
4. **Protect Devices** - Keep your personal devices secure with passwords/biometrics

## Updates

We will promptly address any confirmed security vulnerabilities.
