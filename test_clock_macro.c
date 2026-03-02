#include <stdio.h>
#include <time.h>

int main() {
#ifdef CLOCK_MONOTONIC_RAW
    printf("CLOCK_MONOTONIC_RAW is defined: %d\n", CLOCK_MONOTONIC_RAW);
#else
    printf("CLOCK_MONOTONIC_RAW is NOT defined.\n");
#endif
    return 0;
}
