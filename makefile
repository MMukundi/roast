TEST_DIR = test

TEST_SUFFIX = .test
TEST_RUN_SUFFIX = .test_run
SRC_SUFFIX = .toast

SRCS := $(wildcard $(TEST_DIR)/**$(SRC_SUFFIX))
PRGS :=$(patsubst %$(SRC_SUFFIX), %$(TEST_SUFFIX), $(SRCS))
RUNS := $(patsubst %$(SRC_SUFFIX), %$(TEST_RUN_SUFFIX), $(SRCS))

TOAST = npm run -s toast --
TOASTFLAGS = -od bin

.PHONY: build check clean mkdir_bin

%$(TEST_SUFFIX): %$(SRC_SUFFIX)
	echo "::group::Compile $^"
	$(TOAST) $^ -o $@ $(TOASTFLAGS)
	echo "::endgroup::"

%$(TEST_RUN_SUFFIX): %$(TEST_SUFFIX)
	# echo "::group::Run $^"
	# ../bin/$^
	# echo "::endgroup::"

mkdir_bin: 
	mkdir -p bin/$(TEST_DIR)

build: mkdir_bin $(PRGS)

check: mkdir_bin $(RUNS)

clean:
	rm **$(TEST_SUFFIX)