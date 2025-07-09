package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.Courses;
import com.jfsd.exit_portal_backend.Repository.CoursesRepository;
import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.Optional;

@Service
public class CoursesService {

    @Autowired
    private CoursesRepository coursesRepository;

    public List<Courses> getAllCourses() {
        return coursesRepository.findAll();
    }

    public Courses getCourseById(int id) {
        return coursesRepository.findById(id).orElse(null);
    }

    public Courses saveCourse(Courses course) {
        return coursesRepository.save(course);
    }

    @Transactional
    public List<String> populateCoursesFromCSV(MultipartFile file) {
        ConcurrentLinkedQueue<String> messages = new ConcurrentLinkedQueue<>();
        AtomicInteger updatedRecords = new AtomicInteger(0);
        AtomicInteger createdRecords = new AtomicInteger(0);
        AtomicInteger rowNumberCounter = new AtomicInteger(1);

        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            List<String> lines = br.lines().collect(Collectors.toList());

            List<Courses> coursesToSave = lines.parallelStream()
                .skip(1) // Skip header row
                .map(line -> {
                    int rowNumber = rowNumberCounter.incrementAndGet();
                    String[] values = parseCsvLine(line);

                    if (values.length < 4) {
                        messages.add("Skipping row " + rowNumber + ": Not enough columns.");
                        return null;
                    }

                    String courseCode = values[0].trim();
                    Optional<Courses> existingCourseOpt = coursesRepository.findFirstByCourseCode(courseCode);

                    Courses course;
                    if (existingCourseOpt.isPresent()) {
                        course = existingCourseOpt.get();
                        updatedRecords.incrementAndGet();
                    } else {
                        course = new Courses();
                        course.setCourseCode(courseCode);
                        createdRecords.incrementAndGet();
                    }

                    course.setCourseTitle(values[1].trim().replace("\"", ""));
                    try {
                        course.setCourseCredits(Double.parseDouble(values[2].trim()));
                    } catch (NumberFormatException e) {
                        messages.add("Skipping row " + rowNumber + ": Invalid credit value for course " + courseCode + ".");
                        return null;
                    }
                    course.setCategory(values[3].trim());

                    return course;
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

            if (!coursesToSave.isEmpty()) {
                coursesRepository.saveAll(coursesToSave);
                messages.add("Successfully created " + createdRecords.get() + " and updated " + updatedRecords.get() + " courses.");
            } else {
                messages.add("No valid courses found to import.");
            }

        } catch (IOException e) {
            messages.add("Error reading CSV file: " + e.getMessage());
        }

        return new ArrayList<>(messages);
    }

    private String[] parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (char c : line.toCharArray()) {
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                values.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        values.add(sb.toString().trim());
        return values.toArray(new String[0]);
    }
}
