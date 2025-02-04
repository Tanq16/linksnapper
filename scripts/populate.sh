#!/bin/bash

# Categories and their subcategories
declare -A CATEGORIES=(
    ["Tech"]="Programming/Go Programming/Python Programming/Rust Cloud/AWS Cloud/GCP DevOps Tools"
    ["Science"]="Physics Chemistry Biology Space/NASA Space/Astronomy"
    ["News"]="Technology World Politics Business"
    ["Learning"]="Tutorials Documentation Books/Technical Books/Fiction Courses"
    ["Tools"]="Development Security Productivity"
)

# Function to generate a random description
generate_description() {
    local descriptions=(
        "A comprehensive guide about this topic"
        "Interesting article with detailed insights"
        "Great resource for learning"
        "Useful reference material"
        "In-depth analysis and examples"
        "Quick overview of key concepts"
        "Practical tips and tricks"
        "Essential reading for understanding the basics"
    )
    echo "${descriptions[$((RANDOM % ${#descriptions[@]}))]}"
}

# Add links for each category and subcategory
for category in "${!CATEGORIES[@]}"; do
    IFS=' ' read -ra SUBCATS <<< "${CATEGORIES[$category]}"
    
    # Add some links in the main category
    for i in {1..5}; do
        description=$(generate_description)
        curl -X POST http://localhost:8080/api/links \
            -H "Content-Type: application/json" \
            -d "{
                \"url\": \"https://example.com/test\",
                \"name\": \"Test Resource\",
                \"description\": \"Test description\",
                \"path\": [\"Test\", \"Category\"]
            }"
        echo -e "\nAdded link to ${category}"
        sleep 0.1
    done
    
    # Add links in each subcategory
    for subcat in "${SUBCATS[@]}"; do
        # Handle nested subcategories (those with /)
        if [[ $subcat == *"/"* ]]; then
            IFS='/' read -ra NESTED <<< "$subcat"
            parent_cat=${NESTED[0]}
            child_cat=${NESTED[1]}
            
            # Add 5-10 links in each nested subcategory
            num_links=$((RANDOM % 6 + 5))
            for i in $(seq 1 $num_links); do
                description=$(generate_description)
                curl -X POST http://localhost:8080/api/links \
                    -H "Content-Type: application/json" \
                    -d "{
                        \"url\": \"https://example.com/${category,,}/${parent_cat,,}/${child_cat,,}/$i\",
                        \"name\": \"${child_cat} Resource $i\",
                        \"description\": \"$description\",
                        \"path\": [\"${category}\", \"${parent_cat}\", \"${child_cat}\"]
                    }"
                echo -e "\nAdded link to ${category}/${parent_cat}/${child_cat}"
                sleep 0.1
            done
        else
            # Add 5-10 links in each regular subcategory
            num_links=$((RANDOM % 6 + 5))
            for i in $(seq 1 $num_links); do
                description=$(generate_description)
                curl -X POST http://localhost:8080/api/links \
                    -H "Content-Type: application/json" \
                    -d "{
                        \"url\": \"https://example.com/${category,,}/${subcat,,}/$i\",
                        \"name\": \"${subcat} Resource $i\",
                        \"description\": \"$description\",
                        \"path\": [\"${category}\", \"${subcat}\"]
                    }"
                echo -e "\nAdded link to ${category}/${subcat}"
                sleep 0.1
            done
        fi
    done
done
