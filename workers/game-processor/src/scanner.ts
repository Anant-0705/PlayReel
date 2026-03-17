import { SECURITY_CRITICAL_PATTERNS, SECURITY_WARNING_PATTERNS, BLOCKED_EXTENSIONS } from '../../shared/constants';

export interface ScanResult {
    passed: boolean;          // false = critical flag → reject
    criticalFlags: string[];  // descriptions of critical violations
    warningFlags: string[];   // descriptions of warnings (game stays live)
    scannedFiles: number;
}

/**
 * Scan all JS and HTML file contents for security violations.
 * @param files Map of {filename → content string}
 */
export function scanFiles(files: Map<string, string>): ScanResult {
    const criticalFlags: string[] = [];
    const warningFlags: string[] = [];
    let scannedFiles = 0;

    for (const [filename, content] of files) {
        const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

        // Block dangerous file extensions
        if (BLOCKED_EXTENSIONS.includes(ext)) {
            criticalFlags.push(`Blocked file type found: ${filename}`);
            continue;
        }

        // Only scan JS and HTML
        if (!['.js', '.html', '.htm'].includes(ext)) continue;
        scannedFiles++;

        // Critical patterns → immediate rejection
        for (const { pattern, description } of SECURITY_CRITICAL_PATTERNS) {
            if (pattern.test(content)) {
                criticalFlags.push(`${description} in ${filename}`);
            }
        }

        // Warning patterns → flag but stay live
        for (const { pattern, description } of SECURITY_WARNING_PATTERNS) {
            if (pattern.test(content)) {
                warningFlags.push(`${description} in ${filename}`);
            }
        }
    }

    return {
        passed: criticalFlags.length === 0,
        criticalFlags,
        warningFlags,
        scannedFiles,
    };
}

/** Build the files map from a ZIP's JS/HTML entries */
export function extractTextFiles(zip: import('adm-zip')): Map<string, string> {
    const files = new Map<string, string>();
    const textExtensions = ['.js', '.html', '.htm', '.css'];
    for (const entry of zip.getEntries()) {
        const ext = entry.entryName.slice(entry.entryName.lastIndexOf('.')).toLowerCase();
        if (textExtensions.includes(ext) && !entry.isDirectory) {
            try {
                files.set(entry.entryName, entry.getData().toString('utf8'));
            } catch {
                // Binary file wrongly named .html etc — skip
            }
        }
    }
    return files;
}
