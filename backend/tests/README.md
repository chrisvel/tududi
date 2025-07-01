# Backend Test Suite

This directory contains the test suite for the tududi backend Express application.

## Structure

```
tests/
├── unit/              # Unit tests for individual components
│   ├── models/        # Model tests
│   ├── middleware/    # Middleware tests
│   └── services/      # Service tests
├── integration/       # Integration tests for API endpoints
├── fixtures/          # Test data fixtures
└── helpers/           # Test utilities and helpers
```

## Running Tests

### All Tests

```bash
npm test
```

### Unit Tests Only

```bash
npm run test:unit
```

### Integration Tests Only

```bash
npm run test:integration
```

### Watch Mode (for development)

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

## Test Environment

Tests run in a separate test environment with:

- In-memory SQLite database (isolated from development data)
- Test-specific configuration from `.env.test`
- Automatic database cleanup between tests

## Writing Tests

### Unit Tests

- Test individual functions, models, or middleware in isolation
- Mock external dependencies
- Focus on business logic and edge cases

### Integration Tests

- Test complete API endpoints
- Use authenticated requests where needed
- Test real database interactions
- Verify response formats and status codes

### Test Utilities

- `tests/helpers/testUtils.js` provides utilities for creating test data
- `tests/helpers/setup.js` handles database setup and cleanup
- Use `createTestUser()` for creating authenticated test users

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Database is automatically cleaned between tests
3. **Authentication**: Use test utilities for creating authenticated requests
4. **Descriptive Names**: Test names should clearly describe what is being tested
5. **Coverage**: Aim for high test coverage of critical business logic

## Dependencies

- **Jest**: Test framework
- **Supertest**: HTTP testing library for integration tests
- **cross-env**: Cross-platform environment variable setting
