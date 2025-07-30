# Contributing to CandyComp Location Correction Service

Thank you for your interest in contributing to the CandyComp Location Correction Service! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Reporting Issues](#reporting-issues)

## 📜 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Accept feedback gracefully

## 🚀 Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/candycomp-location-correction.git
   cd candycomp-location-correction
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/Wal33D/candycomp-location-correction.git
   ```

## 💻 Development Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Set Up Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API credentials
   ```

3. **Build the Project:**
   ```bash
   npm run build
   ```

4. **Run Tests:**
   ```bash
   npm test
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```

## 🤝 How to Contribute

### Types of Contributions

- **Bug Fixes**: Fix issues reported in GitHub Issues
- **Features**: Implement new features or enhance existing ones
- **Documentation**: Improve README, API docs, or code comments
- **Tests**: Add missing tests or improve test coverage
- **Performance**: Optimize code for better performance
- **Refactoring**: Improve code quality and maintainability

### Before You Start

1. Check existing issues and pull requests to avoid duplicates
2. For major changes, open an issue first to discuss the proposal
3. Ensure your code follows the project's coding standards

## 🔄 Pull Request Process

1. **Create a Feature Branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes:**
   - Write clean, documented code
   - Add/update tests as needed
   - Update documentation if applicable

3. **Test Your Changes:**
   ```bash
   npm test
   npm run lint
   npm run format:check
   ```

4. **Commit Your Changes:**
   Follow our commit guidelines (see below)

5. **Push to Your Fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request:**
   - Use a clear, descriptive title
   - Reference any related issues
   - Describe what changed and why
   - Include screenshots if applicable

7. **Code Review:**
   - Address review feedback promptly
   - Keep discussions focused and professional

## 📝 Coding Standards

### TypeScript

- Use TypeScript strict mode
- Avoid `any` types - use proper typing
- Use interfaces for object shapes
- Document complex types

### Code Style

- Follow the Prettier configuration
- Use meaningful variable and function names
- Keep functions small and focused
- Add JSDoc comments for public APIs

### Example:
```typescript
/**
 * Validates and corrects an address using USPS and Google Maps
 * @param address - The address to validate
 * @returns Corrected address with geocoding data
 * @throws {ValidationError} If address is invalid
 */
export async function validateAddress(address: AddressInput): Promise<AddressResult> {
    // Implementation
}
```

## 🧪 Testing Guidelines

### Test Requirements

- Write tests for all new features
- Maintain or improve code coverage
- Test edge cases and error scenarios
- Use descriptive test names

### Test Structure

```typescript
describe('ComponentName', () => {
    describe('methodName', () => {
        it('should do something specific', () => {
            // Arrange
            const input = { /* test data */ };
            
            // Act
            const result = methodName(input);
            
            // Assert
            expect(result).toEqual(expectedOutput);
        });
    });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## 💬 Commit Guidelines

We follow conventional commits for clear commit history:

### Format
```
type(scope): subject

body (optional)

footer (optional)
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Examples
```bash
feat(cache): add LRU cache for geocoding results

fix(validation): handle missing city in address validation

docs(api): update endpoint documentation

test(middleware): add tests for error handler
```

## 🐛 Reporting Issues

### Before Reporting

1. Check existing issues for duplicates
2. Try to reproduce the issue
3. Collect relevant information

### Issue Template

When reporting issues, include:

- **Description**: Clear description of the issue
- **Steps to Reproduce**: How to reproduce the issue
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: Node version, OS, etc.
- **Code Sample**: Minimal code to reproduce
- **Error Messages**: Any error messages or logs

### Feature Requests

For feature requests, include:

- **Use Case**: Why is this feature needed?
- **Proposed Solution**: How might it work?
- **Alternatives**: Other solutions considered
- **Additional Context**: Any other relevant information

## 🙏 Recognition

Contributors will be recognized in:
- The project's README
- Release notes for significant contributions
- GitHub's contributor graph

Thank you for contributing to CandyComp Location Correction Service!

---

If you have questions, feel free to:
- Open an issue for discussion
- Contact the maintainers
- Join our community discussions