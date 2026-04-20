package com.project.fridgemate.ui.fridge

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.recyclerview.widget.LinearLayoutManager
import com.project.fridgemate.R
import com.project.fridgemate.databinding.FragmentFridgeBinding

class FridgeFragment : Fragment() {

    private var _binding: FragmentFridgeBinding? = null
    private val binding get() = _binding!!

    private val viewModel: FridgeViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentFridgeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.rvFridge.layoutManager = LinearLayoutManager(requireContext())
        observeViewModel()
        viewModel.loadItems()
    }

    private fun observeViewModel() {
        viewModel.state.observe(viewLifecycleOwner) { state ->
            when (state) {
                is FridgeViewModel.State.Loading -> showLoading()
                is FridgeViewModel.State.Items -> showItems(state.items)
                is FridgeViewModel.State.Empty -> showEmptyState()
                is FridgeViewModel.State.NoFridge -> showNoFridge()
                is FridgeViewModel.State.NotLoggedIn -> showNotLoggedIn()
                is FridgeViewModel.State.Error -> showEmptyState()
            }
        }
    }

    private fun showLoading() {
        binding.loadingOverlay.visibility = View.VISIBLE
        binding.rvFridge.visibility = View.GONE
        binding.emptyState.visibility = View.GONE
    }

    private fun showItems(items: List<FridgeItem>) {
        binding.loadingOverlay.visibility = View.GONE
        binding.rvFridge.adapter = FridgeAdapter(items)
        binding.rvFridge.visibility = View.VISIBLE
        binding.emptyState.visibility = View.GONE
    }

    private fun showEmptyState() {
        binding.loadingOverlay.visibility = View.GONE
        binding.rvFridge.visibility = View.GONE
        binding.emptyState.visibility = View.VISIBLE
        binding.tvEmptyTitle.text = getString(R.string.fridge_empty_title)
        binding.tvEmptyDesc.text = getString(R.string.fridge_empty_desc)
    }

    private fun showNoFridge() {
        binding.loadingOverlay.visibility = View.GONE
        binding.rvFridge.visibility = View.GONE
        binding.emptyState.visibility = View.VISIBLE
        binding.tvEmptyTitle.text = getString(R.string.no_fridge_title)
        binding.tvEmptyDesc.text = getString(R.string.no_fridge_desc)
    }

    private fun showNotLoggedIn() {
        binding.loadingOverlay.visibility = View.GONE
        binding.rvFridge.visibility = View.GONE
        binding.emptyState.visibility = View.VISIBLE
        binding.tvEmptyTitle.text = getString(R.string.fridge_not_logged_in_title)
        binding.tvEmptyDesc.text = getString(R.string.fridge_not_logged_in_desc)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
