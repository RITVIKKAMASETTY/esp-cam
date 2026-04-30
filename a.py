# ==============================
# FIFA DataFrame - PySpark (Easy)
# ==============================

# STEP 1: Install PySpark
!pip install pyspark

# STEP 2: Upload your CSV file
from google.colab import files
files.upload()   # Upload players_16.csv

# STEP 3: Import libraries
from pyspark.sql import SparkSession
from pyspark.sql.functions import col

# STEP 4: Create Spark session
spark = SparkSession.builder.appName("FIFA").getOrCreate()

# STEP 5: Load CSV file
df = spark.read.csv("players_16.csv", header=True, inferSchema=True)

# STEP 6: Show first 10 rows
print("\n===== DATA =====")
df.show(10)

# STEP 7: Print schema
print("\n===== SCHEMA =====")
df.printSchema()

# STEP 8: Count total rows
print("\n===== ROW COUNT =====")
print("Total Rows:", df.count())

# STEP 9: Display column names
print("\n===== COLUMNS =====")
for c in df.columns:
    print(c)

# STEP 10: Statistical summary
print("\n===== STATISTICS =====")
df.describe().show()

# STEP 11: Select specific columns
print("\n===== NAME & NATIONALITY =====")
df.select("Name", "Nationality").show(10)

# STEP 12: Filter a player (example)
print("\n===== FILTER PLAYER =====")
df.filter(col("Name") == "L. Messi").show()

# STEP 13: Top players by Potential
print("\n===== TOP PLAYERS =====")
df.select("Name", "Club", "Potential") \
  .orderBy(col("Potential").desc()) \
  .show(10)

# STEP 14: Players older than 35
print("\n===== AGE > 35 =====")
df.filter(col("Age") > 35) \
  .select("Name", "Age", "Club") \
  .show()

# STEP 15: Count players by nationality
print("\n===== NATIONALITY COUNT =====")
df.groupBy("Nationality").count().show()

print("\n✅ PROGRAM COMPLETED")