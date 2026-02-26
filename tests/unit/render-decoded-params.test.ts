import { describe, expect, test } from 'bun:test';
import { renderDecodedParams } from '../../src/panel-utils';


describe('renderDecodedParams', () => {
  test('returns "No parameters" for null', () => {
    const html = renderDecodedParams(null);
    expect(html).toContain('No parameters');
  });

  test('returns "No parameters" for undefined', () => {
    const html = renderDecodedParams(undefined);
    expect(html).toContain('No parameters');
  });

  test('returns "No parameters" for empty array', () => {
    const html = renderDecodedParams([]);
    expect(html).toContain('No parameters');
  });

  test('returns "No parameters" for empty object', () => {
    const html = renderDecodedParams({});
    expect(html).toContain('No parameters');
  });

  test('renders named params with labels and values', () => {
    const html = renderDecodedParams({ amount: '1000', recipient: '0xABC' });
    expect(html).toContain('amount');
    expect(html).toContain('1000');
    expect(html).toContain('recipient');
    expect(html).toContain('0xABC');
    expect(html).toContain('decoded-param-row');
  });

  test('skips numeric indices when named params exist', () => {
    // viem decoded results often have both numeric and named keys
    const args = { '0': '1000', '1': '0xABC', amount: '1000', recipient: '0xABC' };
    const html = renderDecodedParams(args);
    // Should only show 'amount' and 'recipient', not '0' and '1'
    expect(html).toContain('amount');
    expect(html).toContain('recipient');
    // The numeric rows should be skipped
    const matches = html.match(/decoded-param-row/g);
    expect(matches).toHaveLength(2); // Only 2 rows, not 4
  });

  test('handles BigInt values', () => {
    const html = renderDecodedParams({ value: BigInt('123456789012345678') });
    expect(html).toContain('123456789012345678');
  });

  test('handles nested objects (serialized to JSON)', () => {
    const html = renderDecodedParams({ data: { foo: 'bar', baz: 42 } });
    expect(html).toContain('foo');
    expect(html).toContain('bar');
  });

  test('returns HTML with decoded-params-list wrapper', () => {
    const html = renderDecodedParams({ x: '1' });
    expect(html).toContain('decoded-params-list');
  });

  test('handles primitive argument', () => {
    const html = renderDecodedParams('hello');
    expect(html).toContain('hello');
  });
});
