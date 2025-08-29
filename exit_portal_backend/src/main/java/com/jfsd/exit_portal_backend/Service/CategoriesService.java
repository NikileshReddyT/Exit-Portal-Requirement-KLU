package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.Categories;
import com.jfsd.exit_portal_backend.Repository.CategoriesRepository;
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
public class CategoriesService {

    @Autowired
    private CategoriesRepository categoriesRepository;

    // ... other methods ...

    @Transactional
    public List<String> populateCategoriesFromCSV(MultipartFile file) {
        ConcurrentLinkedQueue<String> messages = new ConcurrentLinkedQueue<>();
        AtomicInteger updatedRecords = new AtomicInteger(0);
        AtomicInteger createdRecords = new AtomicInteger(0);
        AtomicInteger rowNumberCounter = new AtomicInteger(1);

        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            List<String> lines = br.lines().collect(Collectors.toList());

            List<Categories> categoriesToSave = lines.parallelStream()
                .skip(1) // Skip header row
                .map(line -> {
                    int rowNumber = rowNumberCounter.incrementAndGet();
                    String[] values = parseCsvLine(line);

                    if (values.length < 4) {
                        messages.add("Skipping row " + rowNumber + ": Not enough columns.");
                        return null;
                    }

                    String categoryName = values[1].trim();
                    Optional<Categories> existingCategoryOpt = categoriesRepository.findByCategoryNameIgnoreCase(categoryName);

                    Categories category;
                    if (existingCategoryOpt.isPresent()) {
                        category = existingCategoryOpt.get();
                        updatedRecords.incrementAndGet();
                    } else {
                        category = new Categories();
                        category.setCategoryName(categoryName);
                        createdRecords.incrementAndGet();
                    }

                    // Note: Min courses and credits are now handled by ProgramCategoryRequirement
                    // This service now only handles category names and program relationships

                    return category;
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

            if (!categoriesToSave.isEmpty()) {
                categoriesRepository.saveAll(categoriesToSave);
                messages.add("Successfully created " + createdRecords.get() + " and updated " + updatedRecords.get() + " categories.");
            } else {
                messages.add("No valid categories found to import.");
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

    public void addCourseCredits(MultipartFile file) {
        // TODO Auto-generated method stub
        throw new UnsupportedOperationException("Unimplemented method 'addCourseCredits'");
    }
}