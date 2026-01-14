# Design Document: Metadata Integrity Checker

## Overview

The Metadata Integrity Checker is a Node.js utility that validates project metadata across multiple dimensions:
- File duplication detection using content hashing and similarity algorithms
- Test coverage mapping by parsing test files for requirement references
- Requirement traceability by scanning code for requirement comments
- Spec consistency validation by checking alignment between spec files
- Import/export consistency analysis for JavaScript files
- Configurable filtering and multiple output formats

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│         Metadata Integrity Checker                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Configuration Manager                                │   │
│  │ - Load config file                                   │   │
│  │ - Parse include/exclude patterns                     │   │
│  │ - Set defaults                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ File Scanner                                         │   │
│  │ - Traverse directory tree                            │   │
│  │ - Apply filters                                      │   │
│  │ - Collect file metadata                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Analysis Engines (parallel)                          │   │
│  │ ┌────────────────────────────────────────────────┐   │   │
│  │ │ Duplication Detector                           │   │   │
│  │ │ - Hash file content                            │   │   │
│  │ │ - Compare hashes                               │   │   │
│  │ │ - Calculate similarity                         │   │   │
│  │ └────────────────────────────────────────────────┘   │   │
│  │ ┌────────────────────────────────────────────────┐   │   │
│  │ │ Test Coverage Mapper                           │   │   │
│  │ │ - Parse test files                             │   │   │
│  │ │ - Extract requirement references               │   │   │
│  │ │ - Map tests to requirements                    │   │   │
│  │ └────────────────────────────────────────────────┘   │   │
│  │ ┌────────────────────────────────────────────────┐   │   │
│  │ │ Requirement Tracer                             │   │   │
│  │ │ - Parse code files                             │   │   │
│  │ │ - Extract requirement references               │   │   │
│  │ │ - Map code to requirements                     │   │   │
│  │ └────────────────────────────────────────────────┘   │   │
│  │ ┌────────────────────────────────────────────────┐   │   │
│  │ │ Spec Validator                                 │   │   │
│  │ │ - Check spec file existence                    │   │   │
│  │ │ - Validate cross-references                    │   │   │
│  │ │ - Check consistency                            │   │   │
│  │ └────────────────────────────────────────────────┘   │   │
│  │ ┌────────────────────────────────────────────────┐   │   │
│  │ │ Import/Export Analyzer                         │   │   │
│  │ │ - Parse JavaScript AST                         │   │   │
│  │ │ - Identify unused imports                      │   │   │
│  │ │ - Identify missing exports                     │   │   │
│  │ └────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Report Generator                                     │   │
│  │ - Aggregate results                                  │   │
│  │ - Format output (JSON, human-readable, CSV)          │   │
│  │ - Generate recommendations                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Output                                               │   │
│  │ - Console output                                     │   │
│  │ - File output                                        │   │
│  │ - Exit code                                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Configuration Manager

```javascript
class ConfigurationManager {
  loadConfig(configPath)           // Load config from file
  getIncludePatterns()             // Get file include patterns
  getExcludePatterns()             // Get file exclude patterns
  getAnalysisOptions()             // Get analysis options
  getOutputFormat()                // Get output format preference
}
```

### 2. File Scanner

```javascript
class FileScanner {
  scanDirectory(rootPath)          // Scan directory tree
  getFiles()                       // Get filtered file list
  getFileMetadata(filePath)        // Get file info (size, hash, type)
  filterFiles(patterns)            // Apply include/exclude filters
}
```

### 3. Duplication Detector

```javascript
class DuplicationDetector {
  hashFile(filePath)               // Generate content hash
  findDuplicates(files)            // Find exact duplicates
  findSimilarFiles(files)          // Find similar files
  calculateSimilarity(content1, content2) // Calculate similarity %
  generateDuplicateReport()        // Generate detailed report
}
```

### 4. Test Coverage Mapper

```javascript
class TestCoverageMapper {
  parseTestFile(filePath)          // Parse test file
  extractRequirementReferences()   // Extract requirement IDs
  mapTestsToRequirements()         // Create test→requirement mapping
  findUntestdRequirements()        // Find requirements without tests
  generateCoverageReport()         // Generate coverage report
}
```

### 5. Requirement Tracer

```javascript
class RequirementTracer {
  parseCodeFile(filePath)          // Parse code file
  extractRequirementReferences()   // Extract requirement IDs
  mapCodeToRequirements()          // Create code→requirement mapping
  findUnimplementedRequirements()  // Find requirements without code
  generateTraceabilityReport()     // Generate traceability report
}
```

### 6. Spec Validator

```javascript
class SpecValidator {
  validateSpecFiles(specPath)      // Validate spec directory
  checkFileExistence()             // Check requirements.md, design.md, tasks.md
  validateCrossReferences()        // Check references between files
  checkConsistency()               // Check for inconsistencies
  generateValidationReport()       // Generate validation report
}
```

### 7. Import/Export Analyzer

```javascript
class ImportExportAnalyzer {
  parseJavaScriptFile(filePath)    // Parse JS file AST
  findUnusedImports()              // Identify unused imports
  findMissingExports()             // Identify missing exports
  generateAnalysisReport()         // Generate analysis report
}
```

### 8. Report Generator

```javascript
class ReportGenerator {
  aggregateResults(results)        // Combine all analysis results
  formatJSON(results)              // Format as JSON
  formatHumanReadable(results)     // Format as human-readable text
  formatCSV(results)               // Format as CSV
  generateRecommendations(results) // Generate actionable recommendations
}
```

## Data Models

### File Metadata
```javascript
{
  path: string,
  size: number,
  hash: string,
  type: 'js' | 'md' | 'json' | 'other',
  lastModified: Date,
  content: string
}
```

### Duplication Result
```javascript
{
  type: 'exact' | 'similar',
  files: string[],
  similarity: number,  // 0-100
  recommendation: string
}
```

### Test Coverage Result
```javascript
{
  requirement: string,
  tests: string[],
  coverage: number,  // 0-100
  status: 'covered' | 'uncovered'
}
```

### Requirement Trace Result
```javascript
{
  requirement: string,
  implementations: string[],
  status: 'implemented' | 'unimplemented'
}
```

### Spec Validation Result
```javascript
{
  specPath: string,
  files: {
    requirements: boolean,
    design: boolean,
    tasks: boolean
  },
  consistency: {
    valid: boolean,
    issues: string[]
  }
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: File Hash Consistency
*For any* file, computing its hash multiple times should produce the same result.
**Validates: Requirements 1.1**

### Property 2: Duplicate Detection Symmetry
*For any* pair of files with identical content, if file A is detected as a duplicate of file B, then file B should also be detected as a duplicate of file A.
**Validates: Requirements 1.1, 1.2**

### Property 3: Similarity Score Bounds
*For any* two files, the similarity score should be between 0 and 100 inclusive, where 100 means identical content and 0 means completely different.
**Validates: Requirements 1.3**

### Property 4: Test Coverage Completeness
*For any* requirement that has associated tests, those tests should be correctly mapped and counted in the coverage report.
**Validates: Requirements 2.1, 2.2**

### Property 5: Requirement Traceability Consistency
*For any* requirement referenced in code, that requirement should appear in the requirements.md file.
**Validates: Requirements 3.1, 3.2**

### Property 6: Spec File Validation
*For any* spec directory, if all required files (requirements.md, design.md, tasks.md) exist, the validation should report success.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 7: Import/Export Consistency
*For any* JavaScript file, all imported symbols should either be used in the code or marked as intentionally unused.
**Validates: Requirements 5.1, 5.2**

### Property 8: Report Format Validity
*For any* output format (JSON, CSV, human-readable), the generated report should be parseable and contain all required fields.
**Validates: Requirements 8.1, 8.2, 8.3**

## Error Handling

- **File Not Found**: Report missing files with suggestions
- **Permission Denied**: Skip files with permission errors and log
- **Invalid Configuration**: Validate config on load, report errors clearly
- **Parse Errors**: Handle malformed files gracefully, report issues
- **Memory Issues**: Stream large files instead of loading entirely

## Testing Strategy

### Unit Tests
- Test each analyzer component independently
- Test configuration loading and validation
- Test report generation for each format
- Test edge cases (empty files, special characters, etc.)

### Property-Based Tests
- Property 1: File hash consistency across multiple computations
- Property 2: Duplicate detection symmetry
- Property 3: Similarity score bounds validation
- Property 4: Test coverage mapping completeness
- Property 5: Requirement traceability consistency
- Property 6: Spec file validation correctness
- Property 7: Import/export consistency
- Property 8: Report format validity

### Integration Tests
- Test full pipeline with sample project
- Test configuration file loading and application
- Test output generation in all formats
- Test with various file structures and patterns
