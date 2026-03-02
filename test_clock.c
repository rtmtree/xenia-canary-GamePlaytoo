#include <stdio.h>
#include <time.h>

int main() {
    struct timespec res;
    int error = clock_getres(CLOCK_MONOTONIC, &res);
    printf("error: %d\n", error);
    printf("tv_sec: %ld\n", res.tv_sec);
    printf("tv_nsec: %ld\n", res.tv_nsec);
    return 0;
}
