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

    // Strongly-typed holder for extracted entities to avoid unchecked casts
    private static class Entities {
        private final Set<String> programTokens = new HashSet<>();
        private final Set<String> courseTokens = new HashSet<>();
        private final Set<String> categoryTokens = new HashSet<>();
        private final Set<String> years = new HashSet<>();
        private final Set<String> semesters = new HashSet<>();

        Set<String> getProgramTokens() { return programTokens; }
        Set<String> getCourseTokens() { return courseTokens; }
        Set<String> getCategoryTokens() { return categoryTokens; }
        Set<String> getYears() { return years; }
        Set<String> getSemesters() { return semesters; }

        String toCacheSegments() {
            return String.join("|",
                String.join(",", new TreeSet<>(programTokens)),
                String.join(",", new TreeSet<>(courseTokens)),
                String.join(",", new TreeSet<>(categoryTokens)),
                String.join(",", new TreeSet<>(years)),
                String.join(",", new TreeSet<>(semesters))
            );
        }
    }

    private static final String SCHEMA_CONTEXT = """
        Database Schema (3NF normalized):
        
        TABLE programs:
        - program_id (BIGINT, PRIMARY KEY)
        - code (VARCHAR(20), UNIQUE)
        - name (VARCHAR(100))

        sample-data : 
        program_id,code,name
        1,BT-CS,"B Tech - CSE"
        2,BT-AIDS,"B Tech - AIDS"
        3,BT-EEE,"B Tech - EEE"
        4,BT-ECE,"B Tech - ECE"
        5,BT-MECH,"B Tech - MECH"
        6,BT-CIVIL,"B Tech - CIVIL"

        
        TABLE students:
        - student_id (VARCHAR(64), PRIMARY KEY)
        - student_name (VARCHAR)
        - password (VARCHAR)
        - program_id (BIGINT, FOREIGN KEY -> programs.program_id)
        
        TABLE categories:
        - category_id (INT, PRIMARY KEY)
        - category_name (VARCHAR)
        - program_id (BIGINT, FOREIGN KEY -> programs.program_id)

        sample-data : 
        category_id,category_name,program_id
        62,"Audit Courses (AUC)",2
        47,"Basic Sciences (BSC)",2
        48,"Engineering Sciences (ESC)",2

        
        TABLE courses:
        - course_id (INT, PRIMARY KEY)
        - course_code (VARCHAR, UNIQUE)
        - course_title (VARCHAR)
        - course_credits (DOUBLE)

        sample-data : 
        course_id,course_code,course_credits,course_title
        3001,22SDM3507M,3,"INTELLIGENT SOCIAL MEDIA MONITORING SYSTEMS"
        3002,22IE4054R,6,"ENGINEERING CAPSTONE PROJECT - PHASE 2"
        3003,22AD2001,3,"DATA DRIVEN ARTIFICIAL INTELLIGENT SYSTEMS"

        
        TABLE student_grades:
        - sno (BIGINT, PRIMARY KEY)
        - university_id (VARCHAR, FOREIGN KEY -> students.student_id)
        - course_id (INT, FOREIGN KEY -> courses.course_id)
        - grade (VARCHAR)
        - grade_point (DOUBLE)
        - promotion (VARCHAR - 'P' for pass, 'F' for fail)
        - category (VARCHAR)
        - academic_year (VARCHAR)
        - semester (VARCHAR)
        
        sample-data : 
        sno,category,grade,grade_point,promotion,semester,academic_year,course_id,university_id
        129933,"Audit Courses (AUC)",NULL,NULL,R,ODD,2025-2026,3005,2200080001
        130210,"Humanities, Arts & Social Sciences (HAS)",NULL,NULL,R,ODD,2025-2026,3021,2200080001
        127770,"Value Added Courses (VAC)",NULL,NULL,R,ODD,2024-2025,3135,2200080001
        113040,"Placement Training",P,4,P,EVEN,2023-2024,3072,2200080001
        113034,"Basic Sciences (BSC)",A+,9,P,ODD,2023-2024,3015,2200080001
        113018,"Engineering Sciences (ESC)",O,10,P,EVEN,2022-2023,3020,2200080001
        113043,"Professional Core (PCC)",A+,9,P,ODD,2023-2024,3081,2200080001
        
        TABLE program_course_category:
        - id (BIGINT, PRIMARY KEY)
        - program_id (BIGINT, FOREIGN KEY -> programs.program_id)
        - course_id (INT, FOREIGN KEY -> courses.course_id)
        - category_id (INT, FOREIGN KEY -> categories.category_id)

        sample-data : 
        id,category_id,course_id,program_id
        3001,57,3001,2
        3002,58,3002,2
        3003,49,3003,2

        
        TABLE program_category_requirement:
        - id (BIGINT, PRIMARY KEY)
        - program_id (BIGINT, FOREIGN KEY -> programs.program_id)
        - category_id (INT, FOREIGN KEY -> categories.category_id)
        - min_courses (INT)
        - min_credits (DOUBLE)

        sample-data : 
        id,min_courses,min_credits,category_id,program_id
        264,11,18,44,2
        265,1,2,45,2
        266,1,2,46,2

        
        RELATIONSHIPS:
        - Students belong to programs
        - Categories are program-specific
        - Courses are mapped to categories per program via program_course_category
        - Each program-category has minimum requirements in program_category_requirement
        - Student grades link students to courses with academic performance data
        
        RELATIONSHIPS:
        - Students belong to programs
        - Categories are program-specific
        - Courses are mapped to categories per program via program_course_category
        - Each program-category has minimum requirements in program_category_requirement
        - Student grades link students to courses with academic performance data
        - Student category progress stores fulfillment status for category requirements per student
        - Grades reference both students (via university_id) and courses (via course_id)
        - Programs are referenced by categories, students, courses (indirectly), program_course_category, program_category_requirement, and student_category_progress
        - Categories and programs are both referenced in student_category_progress for tracking progress per category in a particular program
        
        DOMAIN RULES AND SEMANTICS:
        - Each program defines a set of categories (e.g., Professional Core, Open Elective, AUC, Sports, etc.).
        - program_category_requirement stores the minimum requirements per category in a program (min_courses and/or min_credits) that a student must fulfill.
        - program_course_category maps which courses belong to which category under a program. A course can appear in multiple categories across different programs.
        - student_grades stores a student's engagement with courses:
            * promotion = 'P' indicates passed (completed) courses with a grade/grade_point.
            * promotion = 'F' indicates failed attempts.
            * promotion = 'R' indicates registered results pending (enrolled but not graded yet).
            * If a course mapped in program_course_category has no record in student_grades for a student, the student has not taken that course yet.
        - student_category_progress stores aggregated fulfillment per category for a student (e.g., completedCourses, completedCredits, pending, etc.) derived from student_grades and mappings.
        - Graduation eligibility: If the student fulfills requirements for ALL categories defined in program_category_requirement for their program, they are eligible for graduation.
        - When computing category completion:
            * Completed courses contribute to completed counts/credits per category.
            * Registered (promotion 'R') courses indicate progress toward fulfilling remaining requirements but are not yet counted as completed.
            * Missing any category requirement keeps the overall graduation status as incomplete.
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
                response.put("type", "results");
                response.put("results", results);
                response.put("count", results.size());
                response.put("sql", cachedSql);
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
                response.put("type", "results");
                response.put("results", results);
                response.put("count", results.size());
                response.put("sql", simpleSql);
                response.put("pattern_matched", true);
                return response;
            } catch (Exception e) {
                // Fall through to AI processing
            }
        }

        // OPTIMIZATION 3: Entity-aware ambiguity skipping
        Entities extracted = extractEntities(naturalLanguageQuery);
        boolean hasSpecificEntities = !extracted.getProgramTokens().isEmpty()
                || !extracted.getCourseTokens().isEmpty()
                || !extracted.getCategoryTokens().isEmpty()
                || !extracted.getYears().isEmpty()
                || !extracted.getSemesters().isEmpty();

        if (!needsAmbiguityCheck(naturalLanguageQuery) || hasSpecificEntities) {
            // Skip STEP 1 for simple or entity-specific queries
        } else {
            // STEP 1: Enhanced Ambiguity Detection (only for complex queries)
            Map<String, Object> ambiguityCheck = checkForAmbiguityWithContext(naturalLanguageQuery);
            if (ambiguityCheck.containsKey("needsClarification")) {
                return ambiguityCheck;
            }
        }

        // STEP 2: Intelligent Relevant Data Fetching (with caching)
        Map<String, Object> relevantData = fetchRelevantDataIntelligentlyWithCache(naturalLanguageQuery);
        // attach extracted entities for downstream use (prompt context and caching)
        relevantData.putIfAbsent("entities", extracted);
        
        // STEP 3: Generate SQL with single AI call (combining generation and optimization)
        String sqlQuery = generateOptimizedQueryDirectly(naturalLanguageQuery, relevantData);
        
        // STEP 4: Execute with iterative AI fix as fallback (bounded attempts)
        Map<String, Object> exec = executeQueryWithLimitedRetry(naturalLanguageQuery, sqlQuery, relevantData);
        @SuppressWarnings("unchecked") List<Map<String, Object>> results = (List<Map<String, Object>>) exec.get("results");
        String finalSql = (String) exec.get("sql");
        boolean fixed = Boolean.TRUE.equals(exec.get("fixed"));

        // Cache successful final SQL (fixed or original)
        queryCache.put(queryKey, finalSql);
        
        Map<String, Object> response = new HashMap<>();
        response.put("query", naturalLanguageQuery);
        response.put("sql", finalSql);
        response.put("results", results);
        response.put("count", results.size());
        response.put("type", "results");
        if (fixed) response.put("ai_fix_applied", true);
        
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
        String q = query == null ? "" : query.toLowerCase().trim();
        Entities ents = extractEntities(q);
        String type = q.contains("student") ? "students" : q.contains("course") ? "courses" :
                q.contains("program") ? "programs" : q.contains("grade") ? "grades" :
                q.contains("category") ? "categories" : "general";
        return type + "|" + ents.toCacheSegments();
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

        // Entities summary (compact) to anchor the model without many tokens
        if (relevantData.containsKey("entities")) {
            Entities ents = (Entities) relevantData.get("entities");
            contextInfo.append("\nEXTRACTED ENTITIES:\n");
            contextInfo.append("Programs: ").append(new TreeSet<>(ents.getProgramTokens())).append('\n');
            contextInfo.append("Courses: ").append(new TreeSet<>(ents.getCourseTokens())).append('\n');
            contextInfo.append("Categories: ").append(new TreeSet<>(ents.getCategoryTokens())).append('\n');
            contextInfo.append("Years: ").append(new TreeSet<>(ents.getYears())).append('\n');
            contextInfo.append("Semesters: ").append(new TreeSet<>(ents.getSemesters())).append('\n');
        }

        // Include requirements and mappings summaries if available (compact)
        if (relevantData.containsKey("requirements")) {
            contextInfo.append("\nCATEGORY REQUIREMENTS (sample):\n");
            @SuppressWarnings("unchecked") List<Map<String, Object>> reqs = (List<Map<String, Object>>) relevantData.get("requirements");
            for (int i = 0; i < Math.min(12, reqs.size()); i++) {
                Map<String, Object> r = reqs.get(i);
                contextInfo.append("- Program ").append(r.get("program_id")).append(", Category '").append(r.get("category_name")).append("' ")
                        .append("min_courses=").append(r.get("min_courses")).append(", min_credits=").append(r.get("min_credits")).append("\n");
            }
        }
        if (relevantData.containsKey("mappingCounts")) {
            contextInfo.append("\nMAPPING COUNTS (sample):\n");
            @SuppressWarnings("unchecked") List<Map<String, Object>> maps = (List<Map<String, Object>>) relevantData.get("mappingCounts");
            for (int i = 0; i < Math.min(12, maps.size()); i++) {
                Map<String, Object> m = maps.get(i);
                contextInfo.append("- Program ").append(m.get("program_id")).append(", Category ").append(m.get("category_id")).append(": courses=").append(m.get("mapped_courses")).append("\n");
            }
        }

        // Universal prompt that works for ALL query types
        String universalPrompt = String.format("""
            you are a sql expert generating the final, optimized query. you have complete context about the database.
            
            database schema: %s
            
            complete data context: %s
            
            user query: "%s"
            
            hard constraints (follow strictly):
            - use lowercase for all sql: keywords, table names, column names, aliases. match schema identifiers exactly (lowercase).
            - use only select/with/where/group by/having/order by/limit; never modify data.
            - prefer exists/not exists for existence checks when appropriate.
            - avoid duplicates using distinct or proper group by when necessary.
            - use lower() for text comparisons and like with wildcards for partial matches.
            - handle null values correctly.
            - return only the sql query, no explanations.
            
            internal reasoning steps (perform silently, do not output):
            1) ambiguity check: if terms are vague, infer the most reasonable interpretation based on provided context values and schema; do not ask the user.
            2) derive all related tables that can influence the result (programs, categories, program_category_requirement, program_course_category, courses, student_grades, student_category_progress) and plan correct joins/filters.
            3) produce the final robust query that will work reliably given data patterns and constraints.
            
            generate the optimized sql query (lowercase only):
            """, SCHEMA_CONTEXT, contextInfo.toString(), naturalLanguageQuery);

        String aiSql = callGeminiAPI(universalPrompt, "gemini-2.0-flash-exp", "sql");
        aiSql = enforceLowercaseSQL(aiSql);
        // ensure read-only and safe before returning
        validateReadOnlyQuery(aiSql);
        return aiSql;
    }

    // Lightweight entity extraction to guide targeted fetching and caching
    private Entities extractEntities(String query) {
        String q = query == null ? "" : query.toLowerCase();
        Entities out = new Entities();
        // Program hints
        if (q.contains("computer science")) out.getProgramTokens().add("cse");
        if (q.contains("aids")) out.getProgramTokens().add("aids");
        if (q.contains("ece")) out.getProgramTokens().add("ece");
        if (q.contains("eee")) out.getProgramTokens().add("eee");
        if (q.contains("mech")) out.getProgramTokens().add("mech");
        if (q.contains("civil")) out.getProgramTokens().add("civil");
        for (String token : q.split("[^a-z0-9-]+")) {
            if (token.matches("[a-z]{2,}-[a-z]+")) out.getProgramTokens().add(token);
        }
        for (String token : q.split("[^a-z0-9]+")) {
            if (token.length() >= 5 && token.matches("[a-z0-9]{5,}")) {
                out.getCourseTokens().add(token);
            }
        }
        int idx = q.indexOf("course ");
        if (idx >= 0) {
            String tail = q.substring(idx + 7).trim();
            for (String t : tail.split(" ")) { if (t.length() > 2) out.getCourseTokens().add(t); }
        }
        String[][] catHints = new String[][]{
                {"professional core", "pcc"},
                {"open elective", "oe"},
                {"professional elective", "pe"},
                {"basic sciences", "bsc"},
                {"engineering sciences", "esc"},
                {"humanities", "has"},
                {"audit", "auc"},
                {"value added", "vac"}
        };
        for (String[] h : catHints) {
            if (q.contains(h[0])) out.getCategoryTokens().add(h[0]);
            if (q.contains(h[1])) out.getCategoryTokens().add(h[1]);
        }
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\b\\d{4}-\\d{4}\\b)|(\\b\\d{2}-\\d{2}\\b)").matcher(q);
        while (m.find()) { String y = m.group(); if (y != null) out.getYears().add(y); }
        if (q.contains("odd")) out.getSemesters().add("odd");
        if (q.contains("even")) out.getSemesters().add("even");
        if (q.contains("summer")) out.getSemesters().add("summer");
        if (q.contains("winter")) out.getSemesters().add("winter");
        m = java.util.regex.Pattern.compile("semester\\s*(\\d)").matcher(q);
        while (m.find()) { out.getSemesters().add(m.group(1)); }
        return out;
    }
    
    private Map<String, Object> executeQueryWithLimitedRetry(String originalQuery, String sqlQuery, Map<String, Object> relevantData) throws Exception {
        try {
            // Validate query safety
            if (!isQuerySafe(sqlQuery)) {
                throw new IllegalArgumentException("Query contains forbidden operations");
            }
            
            // Execute the query
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sqlQuery);
            Map<String, Object> out = new HashMap<>();
            out.put("results", rows);
            out.put("sql", sqlQuery);
            out.put("fixed", false);
            return out;
            
        } catch (Exception e) {
            System.err.println("Query execution failed: " + e.getMessage());
            
            // Iterative fix with full context until a working query is returned (bounded attempts)
            String fixedQuery = tryFixQueryIteratively(originalQuery, sqlQuery, e.getMessage(), relevantData, 3);
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(fixedQuery);
            Map<String, Object> out = new HashMap<>();
            out.put("results", rows);
            out.put("sql", fixedQuery);
            out.put("fixed", true);
            return out;
        }
    }
    
    // removed unused fixQuerySimple

    // More robust iterative fixer that shares ALL context + previous error to AI until a working query is produced
    private String tryFixQueryIteratively(String originalQuery,
                                          String failedQuery,
                                          String errorMessage,
                                          Map<String, Object> relevantData,
                                          int maxAttempts) throws Exception {
        StringBuilder contextInfo = new StringBuilder();
        // Programs
        if (relevantData.containsKey("programs")) {
            contextInfo.append("\nAVAILABLE PROGRAMS:\n");
            @SuppressWarnings("unchecked") List<Map<String, Object>> programs = (List<Map<String, Object>>) relevantData.get("programs");
            for (int i = 0; i < Math.min(15, programs.size()); i++) {
                Map<String, Object> program = programs.get(i);
                contextInfo.append("- id: ").append(program.get("program_id"))
                          .append(", code: '").append(program.get("code"))
                          .append("', name: '").append(program.get("name")).append("'\n");
            }
        }
        // Courses (first 20)
        if (relevantData.containsKey("courses")) {
            contextInfo.append("\nCOURSES (sample):\n");
            @SuppressWarnings("unchecked") List<Map<String, Object>> courses = (List<Map<String, Object>>) relevantData.get("courses");
            for (int i = 0; i < Math.min(20, courses.size()); i++) {
                Map<String, Object> c = courses.get(i);
                contextInfo.append("- ").append(c.get("course_code")).append(" '")
                          .append(c.get("course_title")).append("' credits=")
                          .append(c.get("course_credits"));
                if (c.containsKey("total_enrolled")) {
                    contextInfo.append(", enrolled=").append(c.get("total_enrolled"))
                              .append(", graded=").append(c.get("graded_count"))
                              .append(", pending=").append(c.get("pending_results"));
                }
                contextInfo.append("\n");
            }
        }
        // Categories
        if (relevantData.containsKey("categories")) {
            contextInfo.append("\nCATEGORIES (sample):\n");
            @SuppressWarnings("unchecked") List<Map<String, Object>> cats = (List<Map<String, Object>>) relevantData.get("categories");
            for (int i = 0; i < Math.min(20, cats.size()); i++) {
                Map<String, Object> cat = cats.get(i);
                contextInfo.append("- '").append(cat.get("category_name")).append("' program=")
                          .append(cat.get("program_id")).append("\n");
            }
        }
        // Requirements
        if (relevantData.containsKey("requirements")) {
            contextInfo.append("\nCATEGORY REQUIREMENTS (sample):\n");
            @SuppressWarnings("unchecked") List<Map<String, Object>> reqs = (List<Map<String, Object>>) relevantData.get("requirements");
            for (int i = 0; i < Math.min(20, reqs.size()); i++) {
                Map<String, Object> r = reqs.get(i);
                contextInfo.append("- program ").append(r.get("program_id")).append(", category '")
                          .append(r.get("category_name")).append("' min_courses=")
                          .append(r.get("min_courses")).append(", min_credits=")
                          .append(r.get("min_credits")).append("\n");
            }
        }
        // Mapping counts
        if (relevantData.containsKey("mappingCounts")) {
            contextInfo.append("\nMAPPING COUNTS (sample):\n");
            @SuppressWarnings("unchecked") List<Map<String, Object>> maps = (List<Map<String, Object>>) relevantData.get("mappingCounts");
            for (int i = 0; i < Math.min(20, maps.size()); i++) {
                Map<String, Object> m = maps.get(i);
                contextInfo.append("- program ").append(m.get("program_id")).append(", category ")
                          .append(m.get("category_id")).append(": courses=")
                          .append(m.get("mapped_courses")).append("\n");
            }
        }
        // Entities
        if (relevantData.containsKey("entities")) {
            Entities ents = (Entities) relevantData.get("entities");
            contextInfo.append("\nENTITIES:\n");
            contextInfo.append("programs: ").append(new TreeSet<>(ents.getProgramTokens())).append('\n');
            contextInfo.append("courses: ").append(new TreeSet<>(ents.getCourseTokens())).append('\n');
            contextInfo.append("categories: ").append(new TreeSet<>(ents.getCategoryTokens())).append('\n');
            contextInfo.append("years: ").append(new TreeSet<>(ents.getYears())).append('\n');
            contextInfo.append("semesters: ").append(new TreeSet<>(ents.getSemesters())).append('\n');
        }

        String basePrompt = """
            you are a sql expert fixing a failed query. provide the corrected sql in lowercase only.
            
            database schema: %s
            
            complete data context:
            %s
            
            original natural language query: "%s"
            previous sql query (failed): %s
            error message: %s
            
            hard constraints:
            - use lowercase for all sql: keywords, table names, column names, aliases. match schema identifiers exactly (lowercase).
            - use only select/with/where/group by/having/order by/limit; never modify data.
            - prefer exists/not exists where appropriate; avoid duplicates with distinct/group by.
            - use lower() and like with wildcards for fuzzy text matching.
            - return only the sql query, no explanations.
            
            corrected sql (lowercase only):
            """;

        String currentFailed = failedQuery;
        String currentError = errorMessage;
        Exception lastEx = null;
        for (int attempt = 1; attempt <= Math.max(1, maxAttempts); attempt++) {
            String prompt = String.format(basePrompt, SCHEMA_CONTEXT, contextInfo.toString(), originalQuery, currentFailed, currentError);
            String candidate = callGeminiAPI(prompt, "gemini-pro", "sql");
            candidate = enforceLowercaseSQL(candidate);
            try {
                validateReadOnlyQuery(candidate);
                if (!isQuerySafe(candidate)) {
                    throw new IllegalArgumentException("Fixed query contains forbidden operations");
                }
                // Try executing
                jdbcTemplate.queryForList(candidate);
                return candidate; // success
            } catch (Exception execEx) {
                lastEx = execEx;
                currentFailed = candidate;
                currentError = execEx.getMessage();
            }
        }
        throw new Exception("AI iterative fix failed after attempts: " + (maxAttempts) + ", last error: " + (lastEx == null ? "unknown" : lastEx.getMessage()));
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
            
            If clarification needed, write a brief, direct question and simple to understand.
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

    // Removed unused: checkForClarification

    // STEP 2: Intelligent Relevant Data Fetching
    private Map<String, Object> fetchRelevantDataIntelligently(String naturalLanguageQuery) throws Exception {
        Map<String, Object> relevantData = new HashMap<>();
        String q = naturalLanguageQuery == null ? "" : naturalLanguageQuery.toLowerCase();
        Entities ents = extractEntities(q);
        Set<String> programTokens = ents.getProgramTokens();
        Set<String> courseTokens = ents.getCourseTokens();
        Set<String> categoryTokens = ents.getCategoryTokens();
        Set<String> years = ents.getYears();
        Set<String> semesters = ents.getSemesters();

        try {
            boolean needsPrograms = q.contains("program") || q.contains("student") || !programTokens.isEmpty();
            boolean needsCourses = q.contains("course") || q.contains("subject") || q.contains("class") || q.contains("grade") || !courseTokens.isEmpty();
            boolean needsGrades = q.contains("grade") || q.contains("gpa") || q.contains("score") || q.contains("promotion") || q.contains("result") || !years.isEmpty() || !semesters.isEmpty();
            boolean needsCategories = q.contains("category") || q.contains("elective") || q.contains("core") || !categoryTokens.isEmpty();
            boolean needsEligibility = q.contains("eligibility") || q.contains("eligible") || q.contains("graduate") || q.contains("graduation");

            // Programs: filter by tokens if present, else sample
            if (needsPrograms) {
                List<Object> params = new ArrayList<>();
                StringBuilder sql = new StringBuilder("SELECT program_id, code, name FROM programs ");
                if (!programTokens.isEmpty()) {
                    sql.append("WHERE ");
                    List<String> ors = new ArrayList<>();
                    for (String t : programTokens) {
                        ors.add("(LOWER(code) LIKE ? OR LOWER(name) LIKE ?)");
                        String like = "%" + t + "%";
                        params.add(like);
                        params.add(like);
                    }
                    sql.append(String.join(" OR ", ors));
                }
                sql.append(" ORDER BY code LIMIT 10");
                List<Map<String, Object>> programs = params.isEmpty() ?
                        jdbcTemplate.queryForList(sql.toString()) :
                        jdbcTemplate.queryForList(sql.toString(), params.toArray());
                relevantData.put("programs", programs);
            }

            // Courses: filter by tokens; include lightweight enrollment stats; cap results
            if (needsCourses) {
                List<Object> params = new ArrayList<>();
                StringBuilder sql = new StringBuilder(
                        "SELECT c.course_id, c.course_code, c.course_title, c.course_credits, " +
                        "COUNT(DISTINCT sg.university_id) AS total_enrolled, " +
                        "SUM(CASE WHEN sg.grade IS NOT NULL AND sg.grade != '' THEN 1 ELSE 0 END) AS graded_count, " +
                        "SUM(CASE WHEN sg.promotion = 'R' THEN 1 ELSE 0 END) AS pending_results " +
                        "FROM courses c LEFT JOIN student_grades sg ON c.course_id = sg.course_id ");
                if (!courseTokens.isEmpty()) {
                    sql.append("WHERE ");
                    List<String> ors = new ArrayList<>();
                    for (String t : courseTokens) {
                        ors.add("(LOWER(c.course_code) LIKE ? OR LOWER(c.course_title) LIKE ?)");
                        String like = "%" + t + "%";
                        params.add(like);
                        params.add(like);
                    }
                    sql.append(String.join(" OR ", ors));
                }
                sql.append(" GROUP BY c.course_id, c.course_code, c.course_title, c.course_credits ORDER BY c.course_code LIMIT 30");
                List<Map<String, Object>> courses = params.isEmpty() ?
                        jdbcTemplate.queryForList(sql.toString()) :
                        jdbcTemplate.queryForList(sql.toString(), params.toArray());
                relevantData.put("courses", courses);
            }

            // Grades: patterns and samples filtered by years/semesters if present; small caps
            if (needsGrades) {
                List<Map<String, Object>> gradePatterns = jdbcTemplate.queryForList(
                        "SELECT grade, grade_point, promotion, COUNT(*) AS count FROM student_grades " +
                                "GROUP BY grade, grade_point, promotion ORDER BY count DESC LIMIT 15");
                relevantData.put("gradePatterns", gradePatterns);

                List<Object> params = new ArrayList<>();
                StringBuilder sql = new StringBuilder(
                        "SELECT sg.university_id, c.course_code, c.course_title, sg.grade, sg.grade_point, sg.promotion, sg.academic_year " +
                                "FROM student_grades sg JOIN courses c ON sg.course_id = c.course_id ");
                List<String> where = new ArrayList<>();
                if (!years.isEmpty()) {
                    List<String> ors = new ArrayList<>();
                    for (String y : years) { ors.add("LOWER(sg.academic_year) LIKE ?"); params.add("%" + y + "%"); }
                    where.add("(" + String.join(" OR ", ors) + ")");
                }
                if (!semesters.isEmpty()) {
                    List<String> ors = new ArrayList<>();
                    for (String s : semesters) { ors.add("LOWER(sg.semester) LIKE ?"); params.add("%" + s + "%"); }
                    where.add("(" + String.join(" OR ", ors) + ")");
                }
                if (!where.isEmpty()) sql.append("WHERE ").append(String.join(" AND ", where)).append(' ');
                sql.append("ORDER BY sg.academic_year DESC, c.course_code LIMIT 15");
                List<Map<String, Object>> sampleGrades = params.isEmpty() ?
                        jdbcTemplate.queryForList(sql.toString()) :
                        jdbcTemplate.queryForList(sql.toString(), params.toArray());
                relevantData.put("sampleGrades", sampleGrades);
            }

            // Categories: filter by tokens if present; else sample
            if (needsCategories) {
                List<Object> params = new ArrayList<>();
                StringBuilder sql = new StringBuilder(
                        "SELECT cat.category_id, cat.category_name, cat.program_id, p.name AS program_name " +
                                "FROM categories cat JOIN programs p ON cat.program_id = p.program_id ");
                if (!categoryTokens.isEmpty()) {
                    sql.append("WHERE ");
                    List<String> ors = new ArrayList<>();
                    for (String t : categoryTokens) {
                        ors.add("LOWER(cat.category_name) LIKE ?");
                        params.add("%" + t + "%");
                    }
                    sql.append(String.join(" OR ", ors));
                }
                sql.append(" ORDER BY cat.program_id, cat.category_name LIMIT 30");
                List<Map<String, Object>> categories = params.isEmpty() ?
                        jdbcTemplate.queryForList(sql.toString()) :
                        jdbcTemplate.queryForList(sql.toString(), params.toArray());
                relevantData.put("categories", categories);
            }

            // Requirements and mapping counts to inform eligibility/category completion queries
            if (needsCategories || needsPrograms || needsEligibility) {
                // Program category requirements summary
                List<Map<String, Object>> requirements = jdbcTemplate.queryForList(
                        "SELECT r.program_id, r.category_id, r.min_courses, r.min_credits, c.category_name " +
                                "FROM program_category_requirement r JOIN categories c ON r.category_id = c.category_id " +
                                "ORDER BY r.program_id, c.category_name LIMIT 50");
                relevantData.put("requirements", requirements);

                // Mapping counts per category to know available courses volume
                List<Map<String, Object>> mappingCounts = jdbcTemplate.queryForList(
                        "SELECT p.program_id, p.category_id, COUNT(*) AS mapped_courses " +
                                "FROM program_course_category p GROUP BY p.program_id, p.category_id " +
                                "ORDER BY p.program_id, p.category_id LIMIT 50");
                relevantData.put("mappingCounts", mappingCounts);

                // Very small sample of student_category_progress to show structure
                try {
                    List<Map<String, Object>> scpSamples = jdbcTemplate.queryForList(
                            "SELECT university_id, program_id, category_id, completed_courses, completed_credits, is_completed " +
                                    "FROM student_category_progress LIMIT 10");
                    relevantData.put("categoryProgressSamples", scpSamples);
                } catch (Exception ignored) {
                    // table may not exist in some environments; ignore
                }
            }

        } catch (Exception e) {
            System.err.println("Warning: Failed to fetch relevant data: " + e.getMessage());
        }

        // Also expose entities in relevant data
        relevantData.put("entities", ents);
        return relevantData;
    }

    // Removed unused: generateFinalQueryWithContext

    // STEP 4: Query Optimization
    // Removed unused: optimizeQuery

    // STEP 5: Execute Query with Retry and AI Error Correction
    // Removed unused: executeQueryWithRetry

    // Removed unused: fixQueryWithAI (we keep fixQuerySimple for one-shot correction)

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

    // Lowercase SQL outside of string/identifier quotes to comply with schema casing
    private String enforceLowercaseSQL(String sql) {
        if (sql == null) return null;
        String s = sql.trim();
        StringBuilder sb = new StringBuilder(s.length());
        boolean inSingle = false, inDouble = false, inBacktick = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\'' && !inDouble && !inBacktick) {
                inSingle = !inSingle;
                sb.append(c);
            } else if (c == '"' && !inSingle && !inBacktick) {
                inDouble = !inDouble;
                sb.append(c);
            } else if (c == '`' && !inSingle && !inDouble) {
                inBacktick = !inBacktick;
                sb.append(c);
            } else {
                if (inSingle || inDouble || inBacktick) {
                    sb.append(c);
                } else {
                    sb.append(Character.toLowerCase(c));
                }
            }
        }
        return sb.toString();
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
