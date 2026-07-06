cmake_minimum_required(VERSION 3.22.1)

project(frame_processor_v2)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Include directories
include_directories(
    ${CMAKE_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/zxing-cpp/core/src
    ${CMAKE_SOURCE_DIR}/zxing-cpp/core/src/libzueci
)

# ZXing-cpp sources (embedded for Android)
file(GLOB_RECURSE ZXING_SOURCES 
    "${CMAKE_SOURCE_DIR}/zxing-cpp/core/src/*.cpp"
)

# ZUECI library (character encoding)
set(ZUECI_SOURCES
    ${CMAKE_SOURCE_DIR}/zxing-cpp/core/src/libzueci/zueci.c
)

# JNI wrapper (standalone version)
set(JNI_SOURCES
    ${CMAKE_SOURCE_DIR}/frame_processor_jni.cpp
)

# Build shared library
add_library(frame_processor_v2 SHARED
    ${JNI_SOURCES}
    ${ZXING_SOURCES}
    ${ZUECI_SOURCES}
)

# Compiler flags
target_compile_options(frame_processor_v2 PRIVATE
    -fexceptions
    -frtti
    -O3
    -DZXING_READERS
    -DZXING_EXPERIMENTAL_API
)

# Link libraries
target_link_libraries(frame_processor_v2
    log
    android
    jnigraphics
)
