.PHONY: clean-mem e1

clean-mem:
	-pkill -f "next-server"
	-pkill -f "next dev"
	-.venv/bin/python -c "import torch; torch.mps.empty_cache()" 2>/dev/null || true

e1:
	bash experiments/e1_external_validation/run_all.sh
