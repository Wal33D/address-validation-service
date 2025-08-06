import { addressPreprocessor } from '../../src/utils/AddressPreprocessor';

describe('AddressPreprocessor', () => {
  describe('preprocessStreetAddress', () => {
    it('should add periods to single directional abbreviations', () => {
      const testCases = [
        { input: '123 N Main St', expected: '123 N. Main St.' },
        { input: '456 S Broadway', expected: '456 S. Broadway' },
        { input: '789 E 5th Ave', expected: '789 E. 5th Ave.' },
        { input: '101 W Oak Dr', expected: '101 W. Oak Dr.' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(addressPreprocessor.preprocessStreetAddress(input)).toBe(expected);
      });
    });

    it('should add periods to compound directional abbreviations', () => {
      const testCases = [
        { input: '123 NE Elm St', expected: '123 NE. Elm St.' },
        { input: '456 NW River Rd', expected: '456 NW. River Rd.' },
        { input: '789 SE Park Blvd', expected: '789 SE. Park Blvd.' },
        { input: '101 SW Lake Ave', expected: '101 SW. Lake Ave.' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(addressPreprocessor.preprocessStreetAddress(input)).toBe(expected);
      });
    });

    it('should add periods to street type abbreviations', () => {
      const testCases = [
        { input: '123 Main St', expected: '123 Main St.' },
        { input: '456 Oak Ave', expected: '456 Oak Ave.' },
        { input: '789 Park Rd', expected: '789 Park Rd.' },
        { input: '101 River Dr', expected: '101 River Dr.' },
        { input: '202 Lake Blvd', expected: '202 Lake Blvd.' },
        { input: '303 Pine Ln', expected: '303 Pine Ln.' },
        { input: '404 Maple Ct', expected: '404 Maple Ct.' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(addressPreprocessor.preprocessStreetAddress(input)).toBe(expected);
      });
    });

    it('should handle multiple abbreviations in one address', () => {
      expect(addressPreprocessor.preprocessStreetAddress('123 N Main St')).toBe('123 N. Main St.');
      expect(addressPreprocessor.preprocessStreetAddress('456 SE River Rd')).toBe(
        '456 SE. River Rd.'
      );
    });

    it('should not add periods if already present', () => {
      expect(addressPreprocessor.preprocessStreetAddress('123 N. Main St.')).toBe(
        '123 N. Main St.'
      );
    });

    it('should normalize spacing', () => {
      expect(addressPreprocessor.preprocessStreetAddress('123   N    Main    St')).toBe(
        '123 N. Main St.'
      );
    });

    it('should handle the specific error case from analysis', () => {
      expect(addressPreprocessor.preprocessStreetAddress('6470 S Stony Road')).toBe(
        '6470 S. Stony Road'
      );
    });
  });

  describe('validateCity', () => {
    it('should correct known Michigan city issues', () => {
      expect(addressPreprocessor.validateCity('St Joseph', 'MI', undefined)).toBe('Saint Joseph');
      expect(addressPreprocessor.validateCity('St Clair', 'MI', undefined)).toBe('Saint Clair');
    });

    it('should return null for invalid city with no ZIP', () => {
      expect(addressPreprocessor.validateCity('McBride', 'MI', undefined)).toBeUndefined();
    });

    it('should use ZIP lookup for invalid city', () => {
      expect(addressPreprocessor.validateCity('McBride', 'MI', '48852')).toBe('Mount Pleasant');
    });

    it('should use ZIP lookup when no city provided', () => {
      expect(addressPreprocessor.validateCity(undefined, 'MI', '48852')).toBe('Mount Pleasant');
    });

    it('should handle state case insensitively', () => {
      expect(addressPreprocessor.validateCity('St Joseph', 'mi', undefined)).toBe('Saint Joseph');
    });

    it('should return original city if no corrections needed', () => {
      expect(addressPreprocessor.validateCity('Detroit', 'MI', undefined)).toBe('Detroit');
    });
  });

  describe('preprocessAddress', () => {
    it('should preprocess complete address', () => {
      const input = {
        streetAddress: '123 N Main St',
        city: 'St Joseph',
        state: 'mi',
        zipCode: '49085',
      };

      const result = addressPreprocessor.preprocessAddress(input);

      expect(result.streetAddress).toBe('123 N. Main St.');
      expect(result.city).toBe('Saint Joseph');
      expect(result.state).toBe('MI');
      expect(result.zipCode).toBe('49085');
      expect(result.cityFromZip).toBe(false);
    });

    it('should handle the specific error case from analysis', () => {
      const input = {
        streetAddress: '2029 Ridge Street',
        city: 'McBride',
        state: 'MI',
        zipCode: '48852',
      };

      const result = addressPreprocessor.preprocessAddress(input);

      expect(result.streetAddress).toBe('2029 Ridge Street');
      expect(result.city).toBe('Mount Pleasant'); // Corrected from ZIP
      expect(result.state).toBe('MI');
      expect(result.zipCode).toBe('48852');
    });

    it('should track when city comes from ZIP', () => {
      const input = {
        streetAddress: '123 Main St',
        state: 'MI',
        zipCode: '48852',
      };

      const result = addressPreprocessor.preprocessAddress(input);

      expect(result.city).toBe('Mount Pleasant');
      expect(result.cityFromZip).toBe(true);
    });
  });

  describe('shouldRetryWithoutCity', () => {
    it('should return true for 400 error with city and ZIP', () => {
      const error = { response: { status: 400 } };
      expect(addressPreprocessor.shouldRetryWithoutCity(error, true, true)).toBe(true);
    });

    it('should return false for non-400 errors', () => {
      const error = { response: { status: 500 } };
      expect(addressPreprocessor.shouldRetryWithoutCity(error, true, true)).toBe(false);
    });

    it('should return false if no city', () => {
      const error = { response: { status: 400 } };
      expect(addressPreprocessor.shouldRetryWithoutCity(error, false, true)).toBe(false);
    });

    it('should return false if no ZIP', () => {
      const error = { response: { status: 400 } };
      expect(addressPreprocessor.shouldRetryWithoutCity(error, true, false)).toBe(false);
    });
  });

  describe('dynamic mappings', () => {
    it('should allow adding ZIP mappings', () => {
      addressPreprocessor.addZipMapping('12345', 'Test City', 'NY');
      expect(addressPreprocessor.validateCity(undefined, 'NY', '12345')).toBe('Test City');
    });

    it('should allow adding city corrections', () => {
      addressPreprocessor.addCityCorrection('OH', 'St Clairsville', 'Saint Clairsville');
      expect(addressPreprocessor.validateCity('St Clairsville', 'OH', undefined)).toBe(
        'Saint Clairsville'
      );
    });
  });
});
