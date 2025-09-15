package com.jfsd.exit_portal_backend.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

import java.util.*;
import java.util.regex.Pattern;

@Service
public class NaturalLanguageQueryService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    // Cache for common queries and patterns to reduce API calls
    private final Map<String, String> queryCache = new HashMap<>();
    private final Map<String, Map<String, Object>> contextCache = new HashMap<>();
    private final Set<String> simplePatterns = new HashSet<>();
    
    // Rate limiting to prevent quota exhaustion
    private long lastApiCall = 0;
    private int apiCallsToday = 0;
    private final int MAX_API_CALLS_PER_DAY = 40; // Leave buffer from 50 limit
    private final long MIN_API_CALL_INTERVAL = 2000; // 2 seconds between calls
    
    // Initialize common patterns that don't need AI
    {
        simplePatterns.add("show all students");
        simplePatterns.add("list all courses");
        simplePatterns.add("show all programs");
        simplePatterns.add("list programs");
        simplePatterns.add("show courses");
        simplePatterns.add("list students");
    }

    private static final String SCHEMA_CONTEXT = """
        Database Schema (3NF normalized):
        
        TABLE programs:
        - program_id (BIGINT, PRIMARY KEY)
        - code (VARCHAR(20), UNIQUE)
        - name (VARCHAR(100))
        
        TABLE students:
        - student_id (VARCHAR(64), PRIMARY KEY)
        - student_name (VARCHAR)
        - password (VARCHAR)
        - program_id (BIGINT, FOREIGN KEY -> programs.program_id)
        
        TABLE categories:
        - categoryID (INT, PRIMARY KEY)
        - category_name (VARCHAR)
        - program_id (BIGINT, FOREIGN KEY -> programs.program_id)
        
        TABLE courses:
        - courseID (INT, PRIMARY KEY)
        - course_code (VARCHAR, UNIQUE)
        - course_title (VARCHAR)
        - course_credits (DOUBLE)
        
        TABLE student_grades:
        - sno (BIGINT, PRIMARY KEY)
        - university_id (VARCHAR, FOREIGN KEY -> students.student_id)
        - course_id (INT, FOREIGN KEY -> courses.courseID)
        - grade (VARCHAR)
        - grade_point (DOUBLE)
        - promotion (VARCHAR - 'P' for pass, 'F' for fail)
        - category (VARCHAR)
        - academic_year (VARCHAR)
        - semester (VARCHAR)
        
        TABLE program_course_category:
        - id (BIGINT, PRIMARY KEY)
        - program_id (BIGINT, FOREIGN KEY -> programs.program_id)
        - course_id (INT, FOREIGN KEY -> courses.courseID)
        - category_id (INT, FOREIGN KEY -> categories.categoryID)
        
        TABLE program_category_requirement:
        - id (BIGINT, PRIMARY KEY)
        - program_id (BIGINT, FOREIGN KEY -> programs.program_id)
        - category_id (INT, FOREIGN KEY -> categories.categoryID)
        - min_courses (INT)
        - min_credits (DOUBLE)
        
        RELATIONSHIPS:
        - Students belong to programs
        - Categories are program-specific
        - Courses are mapped to categories per program via program_course_category
        - Each program-category has minimum requirements in program_category_requirement
        - Student grades link students to courses with academic performance data
        """;

    private static final Pattern FORBIDDEN_PATTERNS = Pattern.compile(
        "(?i)\\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE|CALL|EXEC)\\b"
    );

    public Map<String, Object> processNaturalLanguageQuery(String naturalLanguageQuery) throws Exception {
        if (geminiApiKey == null || geminiApiKey.trim().isEmpty()) {
            throw new IllegalStateException("Gemini API key not configured");
        }

        String queryKey = naturalLanguageQuery.toLowerCase().trim();
        
        // OPTIMIZATION 1: Check cache first
        if (queryCache.containsKey(queryKey)) {
            String cachedSql = queryCache.get(queryKey);
            try {
                List<Map<String, Object>> results = jdbcTemplate.queryForList(cachedSql);
                Map<String, Object> response = new HashMap<>();
                response.put("type", "success");
                response.put("data", results);
                response.put("query", cachedSql);
                response.put("cached", true);
                return response;
            } catch (Exception e) {
                // Remove invalid cached query
                queryCache.remove(queryKey);
            }
        }
        
        // OPTIMIZATION 2: Handle simple patterns without AI
        String simpleSql = handleSimplePatterns(naturalLanguageQuery);
        if (simpleSql != null) {
            try {
                List<Map<String, Object>> results = jdbcTemplate.queryForList(simpleSql);
                queryCache.put(queryKey, simpleSql); // Cache for future use
                Map<String, Object> response = new HashMap<>();
                response.put("type", "success");
                response.put("data", results);
                response.put("query", simpleSql);
                response.put("pattern_matched", true);
                return response;
            } catch (Exception e) {
                // Fall through to AI processing
            }
        }

        // OPTIMIZATION 3: Skip ambiguity check for simple queries
        if (!needsAmbiguityCheck(naturalLanguageQuery)) {
            // Skip STEP 1 for simple queries
        } else {
            // STEP 1: Enhanced Ambiguity Detection (only for complex queries)
            Map<String, Object> ambiguityCheck = checkForAmbiguityWithContext(naturalLanguageQuery);
            if (ambiguityCheck.containsKey("needsClarification")) {
                return ambiguityCheck;
            }
        }

        // STEP 2: Intelligent Relevant Data Fetching (with caching)
        Map<String, Object> relevantData = fetchRelevantDataIntelligentlyWithCache(naturalLanguageQuery);
        
        // STEP 3: Generate SQL with single AI call (combining generation and optimization)
        String sqlQuery = generateOptimizedQueryDirectly(naturalLanguageQuery, relevantData);
        
        // STEP 4: Execute with simplified retry (max 1 retry to save API calls)
        List<Map<String, Object>> results = executeQueryWithLimitedRetry(naturalLanguageQuery, sqlQuery, relevantData);
        
        // Cache successful query
        queryCache.put(queryKey, sqlQuery);
        
        Map<String, Object> response = new HashMap<>();
        response.put("query", naturalLanguageQuery);
        response.put("sql", sqlQuery);
        response.put("results", results);
        response.put("count", results.size());
        response.put("type", "results");
        
        return response;
    }


    // OPTIMIZATION METHODS
    
    private String handleSimplePatterns(String query) {
        String queryLower = query.toLowerCase().trim();
        
        // Handle common simple patterns without AI
        if (queryLower.equals("show all students") || queryLower.equals("list all students") || queryLower.equals("list students")) {
            return "SELECT student_id, student_name, p.name as program_name FROM students s JOIN programs p ON s.program_id = p.program_id ORDER BY student_name";
        }
        if (queryLower.equals("show all courses") || queryLower.equals("list all courses") || queryLower.equals("list courses")) {
            return "SELECT course_code, course_title, course_credits FROM courses ORDER BY course_code";
        }
        if (queryLower.equals("show all programs") || queryLower.equals("list all programs") || queryLower.equals("list programs")) {
            return "SELECT code, name FROM programs ORDER BY code";
        }
        if (queryLower.equals("show categories") || queryLower.equals("list categories")) {
            return "SELECT c.category_name, p.name as program_name FROM categories c JOIN programs p ON c.program_id = p.program_id ORDER BY p.name, c.category_name";
        }
        if (queryLower.contains("count students")) {
            return "SELECT COUNT(*) as total_students FROM students";
        }
        if (queryLower.contains("count courses")) {
            return "SELECT COUNT(*) as total_courses FROM courses";
        }
        if (queryLower.contains("count programs")) {
            return "SELECT COUNT(*) as total_programs FROM programs";
        }
        
        return null; // No simple pattern matched
    }
    
    private boolean needsAmbiguityCheck(String query) {
        String queryLower = query.toLowerCase().trim();
        
        // Skip ambiguity check for simple, clear queries
        if (simplePatterns.contains(queryLower)) return false;
        if (queryLower.startsWith("show all") || queryLower.startsWith("list all")) return false;
        if (queryLower.startsWith("count ")) return false;
        if (queryLower.length() < 10) return false; // Very short queries are usually simple
        
        // Need ambiguity check for complex queries
        return queryLower.contains("best") || queryLower.contains("top") || 
               queryLower.contains("recent") || queryLower.contains("average") ||
               queryLower.contains("compare") || queryLower.contains("between") ||
               queryLower.contains("performance") || queryLower.contains("analysis");
    }
    
    private Map<String, Object> fetchRelevantDataIntelligentlyWithCache(String naturalLanguageQuery) throws Exception {
        String cacheKey = generateCacheKey(naturalLanguageQuery);
        
        // Check cache first
        if (contextCache.containsKey(cacheKey)) {
            return contextCache.get(cacheKey);
        }
        
        // Use existing method but cache the result
        Map<String, Object> relevantData = fetchRelevantDataIntelligently(naturalLanguageQuery);
        contextCache.put(cacheKey, relevantData);
        
        return relevantData;
    }
    
    private String generateCacheKey(String query) {
        String queryLower = query.toLowerCase().trim();
        
        // Generate cache key based on query type
        if (queryLower.contains("student")) return "students";
        if (queryLower.contains("course")) return "courses";
        if (queryLower.contains("program")) return "programs";
        if (queryLower.contains("grade")) return "grades";
        if (queryLower.contains("category")) return "categories";
        
        return "general";
    }
    
    private String generateOptimizedQueryDirectly(String naturalLanguageQuery, Map<String, Object> relevantData) throws Exception {
        // Build comprehensive context from ALL fetched relevant data
        StringBuilder contextInfo = new StringBuilder();
        
        // Include ALL available programs data
        if (relevantData.containsKey("programs")) {
            contextInfo.append("\nAVAILABLE PROGRAMS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> programs = (List<Map<String, Object>>) relevantData.get("programs");
            for (Map<String, Object> program : programs) {
                contextInfo.append("- ID: ").append(program.get("program_id"))
                          .append(", Code: '").append(program.get("code"))
                          .append("', Name: '").append(program.get("name")).append("'\n");
            }
        }
        
        // Include ALL available courses data with enrollment info
        if (relevantData.containsKey("courses")) {
            contextInfo.append("\nCOURSE DATA WITH ENROLLMENT STATUS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> courses = (List<Map<String, Object>>) relevantData.get("courses");
            for (Map<String, Object> course : courses) {
                contextInfo.append("- Course: ").append(course.get("course_code"))
                          .append(" (").append(course.get("course_title")).append(")")
                          .append(", Credits: ").append(course.get("course_credits"));
                if (course.containsKey("total_enrolled")) {
                    contextInfo.append(", Enrolled: ").append(course.get("total_enrolled"))
                              .append(", Graded: ").append(course.get("graded_count"))
                              .append(", Pending: ").append(course.get("pending_results"));
                }
                contextInfo.append("\n");
            }
        }
        
        // Include grade patterns and sample data
        if (relevantData.containsKey("gradePatterns")) {
            contextInfo.append("\nGRADE PATTERNS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> patterns = (List<Map<String, Object>>) relevantData.get("gradePatterns");
            for (Map<String, Object> pattern : patterns) {
                contextInfo.append("- Grade: '").append(pattern.get("grade"))
                          .append("', Points: ").append(pattern.get("grade_point"))
                          .append(", Promotion: '").append(pattern.get("promotion"))
                          .append("', Count: ").append(pattern.get("count")).append("\n");
            }
        }
        
        // Include sample grade records
        if (relevantData.containsKey("sampleGrades")) {
            contextInfo.append("\nSAMPLE GRADE RECORDS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> samples = (List<Map<String, Object>>) relevantData.get("sampleGrades");
            for (int i = 0; i < Math.min(samples.size(), 10); i++) { // Limit samples to reduce tokens
                Map<String, Object> sample = samples.get(i);
                contextInfo.append("- Student: ").append(sample.get("university_id"))
                          .append(", Course: ").append(sample.get("course_code"))
                          .append(", Grade: '").append(sample.get("grade"))
                          .append("', Promotion: '").append(sample.get("promotion"))
                          .append("', Year: ").append(sample.get("academic_year")).append("\n");
            }
        }
        
        // Include categories data
        if (relevantData.containsKey("categories")) {
            contextInfo.append("\nCATEGORIES:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> categories = (List<Map<String, Object>>) relevantData.get("categories");
            for (Map<String, Object> category : categories) {
                contextInfo.append("- Category: '").append(category.get("category_name"))
                          .append("', Program: '").append(category.get("program_name")).append("'\n");
            }
        }

        // Universal prompt that works for ALL query types
        String universalPrompt = String.format("""
            You are a SQL expert generating the FINAL, OPTIMIZED query. You have complete context about the database.
            
            Database Schema: %s
            
            Complete Data Context: %s
            
            User Query: "%s"
            
            UNIVERSAL REQUIREMENTS (apply to ALL queries):
            1. Generate a query that returns EXACTLY what the user wants
            2. Use DISTINCT when needed to avoid duplicates
            3. Use proper GROUP BY when aggregating data
            4. For "courses without grades" or "pending results": use promotion = 'R' or grade IS NULL
            5. Join tables efficiently based on foreign key relationships in schema
            6. Return meaningful column names and aliases
            7. Use the actual data patterns shown in the context above
            8. Handle fuzzy matching: use LOWER() and LIKE for text searches
            9. For partial matches, use wildcards appropriately
            10. Optimize performance with proper WHERE clause ordering
            
            CRITICAL INSTRUCTIONS:
            - Analyze the context data to understand actual database values
            - Use EXISTS/NOT EXISTS for existence checks when appropriate  
            - Don't return duplicate rows (use DISTINCT or proper GROUP BY)
            - Use proper table aliases for readability
            - Handle NULL values appropriately
            - Return ONLY the SQL query, no explanations
            
            Generate the optimized SQL query:
            """, SCHEMA_CONTEXT, contextInfo.toString(), naturalLanguageQuery);

        return callGeminiAPI(universalPrompt, "gemini-2.0-flash-exp", "sql");
    }
    
    private List<Map<String, Object>> executeQueryWithLimitedRetry(String originalQuery, String sqlQuery, Map<String, Object> relevantData) throws Exception {
        try {
            // Validate query safety
            if (!isQuerySafe(sqlQuery)) {
                throw new IllegalArgumentException("Query contains forbidden operations");
            }
            
            // Execute the query
            return jdbcTemplate.queryForList(sqlQuery);
            
        } catch (Exception e) {
            System.err.println("Query execution failed: " + e.getMessage());
            
            // Single retry with simplified AI fix to save API calls
            try {
                String fixedQuery = fixQuerySimple(originalQuery, sqlQuery, e.getMessage());
                if (!isQuerySafe(fixedQuery)) {
                    throw new IllegalArgumentException("Fixed query contains forbidden operations");
                }
                return jdbcTemplate.queryForList(fixedQuery);
            } catch (Exception retryException) {
                throw new Exception("Query execution failed: " + e.getMessage() + ". Retry also failed: " + retryException.getMessage());
            }
        }
    }
    
    private String fixQuerySimple(String originalQuery, String failedQuery, String errorMessage) throws Exception {
        // Simplified fix prompt to reduce token usage
        String fixPrompt = String.format("""
            Fix SQL error:
            Query: %s
            Error: %s
            Schema: %s
            
            Return corrected SQL only.
            """, failedQuery, errorMessage, SCHEMA_CONTEXT);

        return callGeminiAPI(fixPrompt, "gemini-pro", "sql"); // Use gemini-pro for fixes to save quota
    }

    // STEP 1: Enhanced Ambiguity Detection
    private Map<String, Object> checkForAmbiguityWithContext(String naturalLanguageQuery) throws Exception {
        String ambiguityPrompt = String.format("""
            You are an AI that detects ambiguity in database queries. Be STRICT about detecting ambiguity that could drastically change results.
            
            Database Schema: %s
            
            User Query: "%s"
            
            If the query is completely clear and unambiguous, respond with exactly: "CLEAR"
            
            If there is ANY ambiguity that could drastically change the output results, ask for clarification.
            
            CRITICAL AMBIGUITY INDICATORS (always ask for clarification):
            - Query could return vastly different result sets based on interpretation
            - Missing critical filters that would change data scope significantly
            - Ambiguous time periods when historical data matters
            - Unclear aggregation level (individual records vs summaries)
            - Vague qualifiers like "best", "top", "recent" without specific criteria
            - Multiple possible interpretations of the same phrase
            
            If clarification needed, write a brief, direct question.
            """, SCHEMA_CONTEXT, naturalLanguageQuery);

        try {
            String response = callGeminiAPI(ambiguityPrompt, "gemini-2.0-flash-exp", "clarification");
            
            if ("CLEAR".equals(response.trim())) {
                return new HashMap<>();
            }
            
            if (!response.trim().isEmpty()) {
                Map<String, Object> clarification = new HashMap<>();
                clarification.put("type", "clarification");
                clarification.put("needsClarification", true);
                clarification.put("clarificationQuestion", response.trim());
                return clarification;
            }
        } catch (Exception e) {
            System.err.println("Warning: Ambiguity check failed: " + e.getMessage());
        }
        
        return new HashMap<>();
    }

    private Map<String, Object> checkForClarification(String naturalLanguageQuery) throws Exception {
        String clarificationPrompt = String.format("""
            You are an AI assistant that analyzes database queries. Be VERY LENIENT and only ask for clarification when absolutely necessary.
            
            Database Schema: %s
            
            User Query: "%s"
            
            IMPORTANT: Only ask for clarification if the query is COMPLETELY IMPOSSIBLE to execute without additional information.
            
            If you can make reasonable assumptions or generate a useful query, respond with exactly: "CLEAR"
            
            ONLY ask for clarification in these extreme cases:
            - Query is completely vague like "show me data" or "give me information"
            - Query contains contradictory requirements that cannot be resolved
            - Query asks for something that doesn't exist in the database schema at all
            
            DO NOT ask for clarification for:
            - Missing program specification (assume all programs or most common one)
            - Missing time period (assume all time or most recent)
            - General queries like "show students" (assume basic student info)
            - Queries that can be answered with reasonable defaults
            
            If clarification is truly needed, write a brief, direct question.
            
            Examples of when NOT to ask:
            - "show students" → CLEAR (show all students with basic info)
            - "show grades" → CLEAR (show all grades)
            - "computer science students" → CLEAR (find CS program and show students)
            
            Examples of when to ask:
            - "show me data" → "What specific data would you like to see?"
            - "delete everything" → "I can only show data, not delete. What would you like to view?"
            """, SCHEMA_CONTEXT, naturalLanguageQuery);

        try {
            String response = callGeminiAPI(clarificationPrompt, "gemini-2.0-flash-exp", "clarification");
            
            if ("CLEAR".equals(response.trim())) {
                return new HashMap<>(); // No clarification needed
            }
            
            // Since we're no longer using JSON format, treat any non-"CLEAR" response as clarification
            if (!response.trim().isEmpty()) {
                Map<String, Object> clarification = new HashMap<>();
                clarification.put("type", "clarification");
                clarification.put("needsClarification", true);
                clarification.put("clarificationQuestion", response.trim());
                return clarification;
            }
            
        } catch (Exception e) {
            // If clarification check fails completely, proceed with original query
            System.err.println("Warning: Clarification check failed: " + e.getMessage());
        }
        
        // No clarification needed or clarification check failed
        return new HashMap<>();
    }

    // STEP 2: Intelligent Relevant Data Fetching
    private Map<String, Object> fetchRelevantDataIntelligently(String naturalLanguageQuery) throws Exception {
        Map<String, Object> relevantData = new HashMap<>();
        String queryLower = naturalLanguageQuery.toLowerCase();
        
        try {
            // Use intelligent defaults based on query content
            boolean needsPrograms = queryLower.contains("program") || queryLower.contains("computer") || queryLower.contains("cse") || queryLower.contains("student");
            boolean needsCourses = queryLower.contains("course") || queryLower.contains("subject") || queryLower.contains("class") || queryLower.contains("grade");
            boolean needsGrades = queryLower.contains("grade") || queryLower.contains("gpa") || queryLower.contains("score") || queryLower.contains("promotion") || queryLower.contains("result");
            boolean needsCategories = queryLower.contains("category") || queryLower.contains("elective") || queryLower.contains("core");
            
            // Fetch programs if needed
            if (needsPrograms) {
                List<Map<String, Object>> programs = jdbcTemplate.queryForList(
                    "SELECT program_id, code, name FROM programs ORDER BY program_id"
                );
                relevantData.put("programs", programs);
            }
            
            // Fetch courses with comprehensive data
            if (needsCourses) {
                List<Map<String, Object>> courses = jdbcTemplate.queryForList(
                    "SELECT c.courseID, c.course_code, c.course_title, c.course_credits, " +
                    "COUNT(DISTINCT sg.university_id) as total_enrolled, " +
                    "COUNT(CASE WHEN sg.grade IS NOT NULL AND sg.grade != '' THEN 1 END) as graded_count, " +
                    "COUNT(CASE WHEN sg.promotion = 'R' THEN 1 END) as pending_results " +
                    "FROM courses c " +
                    "LEFT JOIN student_grades sg ON c.courseID = sg.course_id " +
                    "GROUP BY c.courseID, c.course_code, c.course_title, c.course_credits " +
                    "ORDER BY c.course_code LIMIT 50"
                );
                relevantData.put("courses", courses);
            }
            
            // Fetch grade patterns and samples
            if (needsGrades) {
                List<Map<String, Object>> gradePatterns = jdbcTemplate.queryForList(
                    "SELECT grade, grade_point, promotion, COUNT(*) as count " +
                    "FROM student_grades " +
                    "GROUP BY grade, grade_point, promotion " +
                    "ORDER BY count DESC LIMIT 20"
                );
                relevantData.put("gradePatterns", gradePatterns);
                
                List<Map<String, Object>> sampleGrades = jdbcTemplate.queryForList(
                    "SELECT sg.university_id, c.course_code, c.course_title, sg.grade, sg.grade_point, sg.promotion, sg.academic_year " +
                    "FROM student_grades sg " +
                    "JOIN courses c ON sg.course_id = c.courseID " +
                    "ORDER BY sg.academic_year DESC, c.course_code LIMIT 30"
                );
                relevantData.put("sampleGrades", sampleGrades);
            }
            
            // Fetch categories if needed
            if (needsCategories) {
                List<Map<String, Object>> categories = jdbcTemplate.queryForList(
                    "SELECT cat.categoryID, cat.category_name, cat.program_id, p.name as program_name " +
                    "FROM categories cat " +
                    "JOIN programs p ON cat.program_id = p.program_id " +
                    "ORDER BY cat.program_id, cat.category_name"
                );
                relevantData.put("categories", categories);
            }
            
        } catch (Exception e) {
            System.err.println("Warning: Failed to fetch relevant data: " + e.getMessage());
        }
        
        return relevantData;
    }

    // STEP 3: Generate Final Query with Complete Context
    private String generateFinalQueryWithContext(String naturalLanguageQuery, Map<String, Object> relevantData) throws Exception {
        StringBuilder contextInfo = new StringBuilder();
        
        // Build comprehensive context from relevant data
        if (relevantData.containsKey("programs")) {
            contextInfo.append("\nAVAILABLE PROGRAMS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> programs = (List<Map<String, Object>>) relevantData.get("programs");
            for (Map<String, Object> program : programs) {
                contextInfo.append("- ID: ").append(program.get("program_id"))
                          .append(", Code: '").append(program.get("code"))
                          .append("', Name: '").append(program.get("name")).append("'\n");
            }
        }
        
        if (relevantData.containsKey("courses")) {
            contextInfo.append("\nCOURSE DATA WITH ENROLLMENT STATUS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> courses = (List<Map<String, Object>>) relevantData.get("courses");
            for (Map<String, Object> course : courses) {
                contextInfo.append("- Course: ").append(course.get("course_code"))
                          .append(" (").append(course.get("course_title")).append(")")
                          .append(", Enrolled: ").append(course.get("total_enrolled"))
                          .append(", Graded: ").append(course.get("graded_count"))
                          .append(", Pending: ").append(course.get("pending_results")).append("\n");
            }
        }
        
        if (relevantData.containsKey("gradePatterns")) {
            contextInfo.append("\nGRADE PATTERNS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> patterns = (List<Map<String, Object>>) relevantData.get("gradePatterns");
            for (Map<String, Object> pattern : patterns) {
                contextInfo.append("- Grade: '").append(pattern.get("grade"))
                          .append("', Points: ").append(pattern.get("grade_point"))
                          .append(", Promotion: '").append(pattern.get("promotion"))
                          .append("', Count: ").append(pattern.get("count")).append("\n");
            }
        }
        
        if (relevantData.containsKey("sampleGrades")) {
            contextInfo.append("\nSAMPLE GRADE RECORDS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> samples = (List<Map<String, Object>>) relevantData.get("sampleGrades");
            for (Map<String, Object> sample : samples) {
                contextInfo.append("- Student: ").append(sample.get("university_id"))
                          .append(", Course: ").append(sample.get("course_code"))
                          .append(", Grade: '").append(sample.get("grade"))
                          .append("', Promotion: '").append(sample.get("promotion"))
                          .append("', Year: ").append(sample.get("academic_year")).append("\n");
            }
        }

        String finalPrompt = String.format("""
            You are a SQL expert generating the FINAL, PERFECT query. You have complete context about the data.
            
            Database Schema: %s
            
            Complete Data Context: %s
            
            User Query: "%s"
            
            CRITICAL REQUIREMENTS:
            1. Generate a query that returns EXACTLY what the user wants
            2. Use DISTINCT when needed to avoid duplicates
            3. Use proper GROUP BY when aggregating
            4. For "courses without grades" or "pending results": use promotion = 'R' or grade IS NULL
            5. Join tables efficiently and correctly
            6. Return meaningful column names
            7. Use the actual data patterns shown above
            
            AVOID COMMON MISTAKES:
            - Don't return duplicate rows (use DISTINCT or proper GROUP BY)
            - Don't join unnecessarily if you just need course info
            - Use EXISTS/NOT EXISTS for existence checks
            - Use proper WHERE conditions based on data patterns
            
            Return ONLY the SQL query, no explanations.
            """, SCHEMA_CONTEXT, contextInfo.toString(), naturalLanguageQuery);

        return callGeminiAPI(finalPrompt, "gemini-2.0-flash-exp", "sql");
    }

    // STEP 4: Query Optimization
    private String optimizeQuery(String sqlQuery, String originalQuery) throws Exception {
        String optimizationPrompt = String.format("""
            You are a SQL optimization expert. Optimize this query for performance and correctness.
            
            Original User Request: "%s"
            Current SQL Query: %s
            
            OPTIMIZATION CHECKLIST:
            1. Remove unnecessary JOINs
            2. Use DISTINCT only when needed
            3. Use EXISTS instead of IN for better performance
            4. Optimize WHERE clause order
            5. Use proper indexes (assume standard indexes exist)
            6. Ensure GROUP BY is used correctly with aggregates
            7. Remove redundant conditions
            8. Use LIMIT if appropriate for large result sets
            
            Return ONLY the optimized SQL query, no explanations.
            """, originalQuery, sqlQuery);

        try {
            return callGeminiAPI(optimizationPrompt, "gemini-2.0-flash-exp", "sql");
        } catch (Exception e) {
            // If optimization fails, return original query
            System.err.println("Warning: Query optimization failed: " + e.getMessage());
            return sqlQuery;
        }
    }

    // STEP 5: Execute Query with Retry and AI Error Correction
    private List<Map<String, Object>> executeQueryWithRetry(String originalQuery, String sqlQuery, Map<String, Object> relevantData) throws Exception {
        int maxRetries = 2;
        String currentQuery = sqlQuery;
        
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Validate query safety
                if (!isQuerySafe(currentQuery)) {
                    throw new IllegalArgumentException("Query contains forbidden operations");
                }
                
                // Execute the query
                List<Map<String, Object>> results = jdbcTemplate.queryForList(currentQuery);
                
                // Log successful execution
                System.out.println("Query executed successfully on attempt " + attempt);
                return results;
                
            } catch (Exception e) {
                System.err.println("Query execution failed on attempt " + attempt + ": " + e.getMessage());
                System.err.println("Failed query: " + currentQuery);
                
                if (attempt == maxRetries) {
                    throw new Exception("Query execution failed after " + maxRetries + " attempts: " + e.getMessage());
                }
                
                // Try to fix the query using AI
                try {
                    currentQuery = fixQueryWithAI(originalQuery, currentQuery, e.getMessage(), relevantData);
                    System.out.println("AI suggested fix for attempt " + (attempt + 1) + ": " + currentQuery);
                } catch (Exception fixException) {
                    System.err.println("AI query fix failed: " + fixException.getMessage());
                    throw new Exception("Query execution and AI fix both failed: " + e.getMessage());
                }
            }
        }
        
        throw new Exception("Unexpected error in query execution retry logic");
    }

    private String fixQueryWithAI(String originalQuery, String failedQuery, String errorMessage, Map<String, Object> relevantData) throws Exception {
        StringBuilder contextInfo = new StringBuilder();
        
        // Build context from relevant data for error fixing
        if (relevantData.containsKey("programs")) {
            contextInfo.append("\nAVAILABLE PROGRAMS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> programs = (List<Map<String, Object>>) relevantData.get("programs");
            for (Map<String, Object> program : programs) {
                contextInfo.append("- ID: ").append(program.get("program_id"))
                          .append(", Code: '").append(program.get("code"))
                          .append("', Name: '").append(program.get("name")).append("'\n");
            }
        }
        
        if (relevantData.containsKey("courses")) {
            contextInfo.append("\nCOURSE DATA:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> courses = (List<Map<String, Object>>) relevantData.get("courses");
            for (int i = 0; i < Math.min(courses.size(), 10); i++) {
                Map<String, Object> course = courses.get(i);
                contextInfo.append("- Course: ").append(course.get("course_code"))
                          .append(" (").append(course.get("course_title")).append(")\n");
            }
        }

        String fixPrompt = String.format("""
            You are a SQL expert fixing a failed query. The query failed with an error and needs to be corrected.
            
            Database Schema: %s
            
            Data Context: %s
            
            Original User Request: "%s"
            Failed SQL Query: %s
            Error Message: %s
            
            COMMON ERROR FIXES:
            1. Column name errors: Check actual column names in schema
            2. Table name errors: Verify table names match schema exactly
            3. JOIN errors: Ensure foreign key relationships are correct
            4. Syntax errors: Fix SQL syntax issues
            5. Data type errors: Use proper data type casting
            6. Aggregate function errors: Use proper GROUP BY clauses
            
            Generate a corrected SQL query that fixes the error while maintaining the original intent.
            Return ONLY the corrected SQL query, no explanations.
            """, SCHEMA_CONTEXT, contextInfo.toString(), originalQuery, failedQuery, errorMessage);

        return callGeminiAPI(fixPrompt, "gemini-pro", "sql");
    }

    // Helper method to validate query safety
    private boolean isQuerySafe(String query) {
        String queryUpper = query.toUpperCase().trim();
        
        // Allow only SELECT and WITH statements
        if (!queryUpper.startsWith("SELECT") && !queryUpper.startsWith("WITH")) {
            return false;
        }
        
        // Check for forbidden keywords
        String[] forbiddenKeywords = {
            "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", 
            "TRUNCATE", "EXEC", "EXECUTE", "CALL", "MERGE", "REPLACE"
        };
        
        for (String keyword : forbiddenKeywords) {
            if (queryUpper.contains(keyword)) {
                return false;
            }
        }
        
        return true;
    }

    private Map<String, Object> gatherQueryContext(String naturalLanguageQuery) throws Exception {
        Map<String, Object> context = new HashMap<>();
        String queryLower = naturalLanguageQuery.toLowerCase();
        
        try {
            // Gather program names and codes for fuzzy matching
            if (queryLower.contains("program") || queryLower.contains("computer") || queryLower.contains("cse") || 
                queryLower.contains("science") || queryLower.contains("tech") || queryLower.contains("student")) {
                List<Map<String, Object>> programs = jdbcTemplate.queryForList(
                    "SELECT DISTINCT program_id, code, name FROM programs"
                );
                context.put("programs", programs);
            }
            
            // Gather academic years for fuzzy matching
            if (queryLower.contains("year") || queryLower.contains("grade") || queryLower.matches(".*\\d{2,4}.*")) {
                List<Map<String, Object>> academicYears = jdbcTemplate.queryForList(
                    "SELECT DISTINCT academic_year FROM student_grades WHERE academic_year IS NOT NULL ORDER BY academic_year"
                );
                context.put("academicYears", academicYears);
            }
            
            // Gather semesters for fuzzy matching
            if (queryLower.contains("semester") || queryLower.contains("fall") || queryLower.contains("spring") || 
                queryLower.contains("summer") || queryLower.contains("winter")) {
                List<Map<String, Object>> semesters = jdbcTemplate.queryForList(
                    "SELECT DISTINCT semester FROM student_grades WHERE semester IS NOT NULL ORDER BY semester"
                );
                context.put("semesters", semesters);
            }
            
            // Gather course codes and titles for fuzzy matching
            if (queryLower.contains("course") || queryLower.contains("subject") || queryLower.contains("class")) {
                List<Map<String, Object>> courses = jdbcTemplate.queryForList(
                    "SELECT DISTINCT courseID, course_code, course_title FROM courses"
                );
                context.put("courses", courses);
            }
            
            // Gather categories for fuzzy matching
            if (queryLower.contains("category") || queryLower.contains("type") || queryLower.contains("elective") || 
                queryLower.contains("core") || queryLower.contains("mandatory")) {
                List<Map<String, Object>> categories = jdbcTemplate.queryForList(
                    "SELECT DISTINCT categoryID, category_name, program_id FROM categories"
                );
                context.put("categories", categories);
            }
            
            // Gather grade values and sample data for fuzzy matching
            if (queryLower.contains("grade") || queryLower.contains("gpa") || queryLower.contains("score") ||
                queryLower.contains("pass") || queryLower.contains("fail") || queryLower.contains("promotion")) {
                List<Map<String, Object>> grades = jdbcTemplate.queryForList(
                    "SELECT DISTINCT grade, grade_point, promotion FROM student_grades WHERE grade IS NOT NULL ORDER BY grade_point DESC LIMIT 10"
                );
                context.put("grades", grades);
                
                // Get sample student_grades data to understand the structure
                List<Map<String, Object>> sampleGrades = jdbcTemplate.queryForList(
                    "SELECT sg.university_id, sg.course_id, sg.grade, sg.grade_point, sg.promotion, sg.academic_year, sg.semester, c.course_code, c.course_title " +
                    "FROM student_grades sg JOIN courses c ON sg.course_id = c.courseID " +
                    "LIMIT 5"
                );
                context.put("sampleGrades", sampleGrades);
            }
            
            // Get sample data for courses and their enrollment status
            if (queryLower.contains("course") || queryLower.contains("subject") || queryLower.contains("class") ||
                queryLower.contains("not given") || queryLower.contains("pending") || queryLower.contains("missing")) {
                // Get courses with and without grades
                List<Map<String, Object>> courseGradeStatus = jdbcTemplate.queryForList(
                    "SELECT c.courseID, c.course_code, c.course_title, " +
                    "COUNT(sg.sno) as enrolled_students, " +
                    "COUNT(CASE WHEN sg.grade IS NOT NULL AND sg.grade != '' THEN 1 END) as graded_students, " +
                    "COUNT(CASE WHEN sg.promotion = 'R' THEN 1 END) as pending_results " +
                    "FROM courses c " +
                    "LEFT JOIN student_grades sg ON c.courseID = sg.course_id " +
                    "GROUP BY c.courseID, c.course_code, c.course_title " +
                    "LIMIT 10"
                );
                context.put("courseGradeStatus", courseGradeStatus);
            }
            
        } catch (Exception e) {
            // If context gathering fails, continue with empty context
            System.err.println("Warning: Failed to gather query context: " + e.getMessage());
        }
        
        return context;
    }

    private String convertToSQLWithContext(String naturalLanguageQuery, Map<String, Object> contextData) throws Exception {
        // Try with fallback mechanism for quota limits
        Exception lastException = null;
        
        // First try with gemini-2.0-flash-exp
        try {
            return callGeminiAPIWithContext(naturalLanguageQuery, "gemini-2.0-flash-exp", contextData);
        } catch (Exception e) {
            lastException = e;
            if (isQuotaExceeded(e)) {
                // Try with gemini-pro as fallback
                try {
                    return callGeminiAPIWithContext(naturalLanguageQuery, "gemini-pro", contextData);
                } catch (Exception e2) {
                    lastException = e2;
                    if (isQuotaExceeded(e2)) {
                        // If both models are quota exceeded, provide helpful error
                        throw new IllegalStateException("Gemini API quota exceeded for all available models. Please check your billing or try again later.");
                    }
                }
            }
        }
        
        // If we get here, throw the last exception
        throw new RuntimeException("Failed to generate SQL query", lastException);
    }

    private String callGeminiAPIWithContext(String naturalLanguageQuery, String model, Map<String, Object> contextData) throws Exception {
        // Build context information for better matching
        StringBuilder contextInfo = new StringBuilder();
        
        if (contextData.containsKey("programs")) {
            contextInfo.append("\nAVAILABLE PROGRAMS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> programs = (List<Map<String, Object>>) contextData.get("programs");
            for (Map<String, Object> program : programs) {
                contextInfo.append("- ID: ").append(program.get("program_id"))
                          .append(", Code: '").append(program.get("code"))
                          .append("', Name: '").append(program.get("name")).append("'\n");
            }
        }
        
        if (contextData.containsKey("academicYears")) {
            contextInfo.append("\nAVAILABLE ACADEMIC YEARS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> years = (List<Map<String, Object>>) contextData.get("academicYears");
            for (Map<String, Object> year : years) {
                contextInfo.append("- '").append(year.get("academic_year")).append("'\n");
            }
        }
        
        if (contextData.containsKey("semesters")) {
            contextInfo.append("\nAVAILABLE SEMESTERS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> semesters = (List<Map<String, Object>>) contextData.get("semesters");
            for (Map<String, Object> semester : semesters) {
                contextInfo.append("- '").append(semester.get("semester")).append("'\n");
            }
        }
        
        if (contextData.containsKey("courses")) {
            contextInfo.append("\nAVAILABLE COURSES (showing first 20):\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> courses = (List<Map<String, Object>>) contextData.get("courses");
            int count = 0;
            for (Map<String, Object> course : courses) {
                if (count++ >= 20) break;
                contextInfo.append("- Code: '").append(course.get("course_code"))
                          .append("', Title: '").append(course.get("course_title")).append("'\n");
            }
        }
        
        if (contextData.containsKey("categories")) {
            contextInfo.append("\nAVAILABLE CATEGORIES:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> categories = (List<Map<String, Object>>) contextData.get("categories");
            for (Map<String, Object> category : categories) {
                contextInfo.append("- ID: ").append(category.get("categoryID"))
                          .append(", Name: '").append(category.get("category_name"))
                          .append("', Program ID: ").append(category.get("program_id")).append("\n");
            }
        }
        
        if (contextData.containsKey("grades")) {
            contextInfo.append("\nAVAILABLE GRADES:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> grades = (List<Map<String, Object>>) contextData.get("grades");
            for (Map<String, Object> grade : grades) {
                contextInfo.append("- Grade: '").append(grade.get("grade"))
                          .append("', Points: ").append(grade.get("grade_point"))
                          .append(", Promotion: '").append(grade.get("promotion")).append("'\n");
            }
        }
        
        if (contextData.containsKey("sampleGrades")) {
            contextInfo.append("\nSAMPLE STUDENT GRADES DATA:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> sampleGrades = (List<Map<String, Object>>) contextData.get("sampleGrades");
            for (Map<String, Object> sample : sampleGrades) {
                contextInfo.append("- Student: ").append(sample.get("university_id"))
                          .append(", Course: ").append(sample.get("course_code"))
                          .append(" (").append(sample.get("course_title")).append(")")
                          .append(", Grade: '").append(sample.get("grade"))
                          .append("', Points: ").append(sample.get("grade_point"))
                          .append(", Promotion: '").append(sample.get("promotion"))
                          .append("', Year: ").append(sample.get("academic_year"))
                          .append(", Semester: ").append(sample.get("semester")).append("\n");
            }
        }
        
        if (contextData.containsKey("courseGradeStatus")) {
            contextInfo.append("\nCOURSE GRADING STATUS:\n");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> courseStatus = (List<Map<String, Object>>) contextData.get("courseGradeStatus");
            for (Map<String, Object> course : courseStatus) {
                contextInfo.append("- Course: ").append(course.get("course_code"))
                          .append(" (").append(course.get("course_title")).append(")")
                          .append(", Enrolled: ").append(course.get("enrolled_students"))
                          .append(", Graded: ").append(course.get("graded_students"))
                          .append(", Pending Results (R): ").append(course.get("pending_results")).append("\n");
            }
        }

        String finalPrompt = String.format("""
            You are a SQL expert. Convert the following natural language query to a valid MySQL SELECT query.
            
            %s
            
            IMPORTANT DATA UNDERSTANDING RULES:
            - ANALYZE the sample data above to understand data patterns and relationships
            - For "grades not given" or "pending results": Look for promotion = 'R' (Result pending)
            - For "courses without grades": Check where grade IS NULL or grade = '' AND promotion = 'R'
            - For "students without grades": Look for entries where grade is missing but enrollment exists
            - Use the COURSE GRADING STATUS data to understand which courses have pending results
            - Use SAMPLE STUDENT GRADES DATA to understand the actual data structure
            
            FUZZY MATCHING RULES:
            - Use CASE-INSENSITIVE matching with LOWER() function for text comparisons
            - Use LIKE with wildcards for partial matches (e.g., LIKE '%%computer%%' for "computer science")
            - For years, match patterns like '2025-2026' with '25-26' or '2025' 
            - For course codes, use LIKE for partial matches (e.g., 'UX' should match 'UX DESIGN')
            - For program names, match variations like 'computer science' with 'B.Tech CSE' or 'CSE'
            - When user mentions partial data, find the closest match from available values above
            
            CONTEXT DATA (use this to understand the actual database state):
            %s
            
            CONSTRAINTS:
            - ONLY use SELECT, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT
            - NO INSERT, UPDATE, DELETE, DROP, etc.
            - Use proper table aliases
            - Handle JOINs correctly based on foreign key relationships
            - Return ONLY the SQL query, no explanations
            - Base your query logic on the actual sample data patterns shown above
            
            Natural Language Query: %s
            
            SQL Query:
            """, SCHEMA_CONTEXT, contextInfo.toString(), naturalLanguageQuery);

        return callGeminiAPI(finalPrompt, model, "sql");
    }

    
    private String callGeminiAPI(String inputPrompt, String model, String type) throws Exception {
        // RATE LIMITING: Check if we've exceeded daily quota or need to wait
        long currentTime = System.currentTimeMillis();
        
        if (apiCallsToday >= MAX_API_CALLS_PER_DAY) {
            throw new IllegalStateException("Daily API quota limit reached (" + MAX_API_CALLS_PER_DAY + " calls). Please try again tomorrow or upgrade your plan.");
        }
        
        if (currentTime - lastApiCall < MIN_API_CALL_INTERVAL) {
            try {
                Thread.sleep(MIN_API_CALL_INTERVAL - (currentTime - lastApiCall));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        
        String finalPrompt;
        
        if ("clarification".equals(type)) {
            finalPrompt = inputPrompt; // Use the clarification prompt as-is
        } else {
            // Build SQL generation prompt
            finalPrompt = String.format("""
                You are a SQL expert. Convert the following natural language query to a valid MySQL SELECT query.
                
                %s
                
                CONSTRAINTS:
                - ONLY use SELECT, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT
                - NO INSERT, UPDATE, DELETE, DROP, etc.
                - Use proper table aliases
                - Handle JOINs correctly based on foreign key relationships
                - Return ONLY the SQL query, no explanations
                
                Natural Language Query: %s
                
                SQL Query:
                """, SCHEMA_CONTEXT, inputPrompt);
        }

        String geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + geminiApiKey;
        
        try {
            Map<String, Object> requestBody = new HashMap<>();
            Map<String, Object> content = new HashMap<>();
            Map<String, String> part = new HashMap<>();
            part.put("text", finalPrompt);
            content.put("parts", Collections.singletonList(part));
            requestBody.put("contents", Collections.singletonList(content));

            HttpHeaders headers = new HttpHeaders();
            headers.set("Content-Type", "application/json");
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(geminiUrl, HttpMethod.POST, request, String.class);
            
            // Update rate limiting counters on successful call
            lastApiCall = System.currentTimeMillis();
            apiCallsToday++;
            
            JsonNode jsonResponse = objectMapper.readTree(response.getBody());
            String sqlQuery = jsonResponse.path("candidates").get(0)
                .path("content").path("parts").get(0).path("text").asText().trim();
            
            // Clean up the response - remove markdown formatting if present
            sqlQuery = sqlQuery.replaceAll("```sql", "").replaceAll("```", "").trim();
            
            return sqlQuery;
            
        } catch (Exception e) {
            // Check if this is a quota error
            if (isQuotaExceeded(e)) {
                apiCallsToday = MAX_API_CALLS_PER_DAY; // Mark as quota exceeded
                throw new IllegalStateException("Gemini API quota exceeded. Error: " + e.getMessage() + 
                    "\\n\\nOptimization suggestions:\\n" +
                    "- Use simpler queries like 'show all students', 'list courses'\\n" +
                    "- Wait a few minutes before trying again\\n" +
                    "- Consider upgrading your Gemini API plan for higher limits");
            }
            throw e;
        }
    }
    
    private boolean isQuotaExceeded(Exception e) {
        String message = e.getMessage();
        return message != null && (
            message.contains("429") || 
            message.contains("quota") || 
            message.contains("RESOURCE_EXHAUSTED") ||
            message.contains("Too Many Requests")
        );
    }

    private void validateReadOnlyQuery(String sqlQuery) {
        if (FORBIDDEN_PATTERNS.matcher(sqlQuery).find()) {
            throw new SecurityException("Query contains forbidden operations. Only SELECT queries are allowed.");
        }
        
        String upperQuery = sqlQuery.toUpperCase().trim();
        if (!upperQuery.startsWith("SELECT") && !upperQuery.startsWith("WITH")) {
            throw new SecurityException("Only SELECT and WITH queries are allowed.");
        }
    }


}
