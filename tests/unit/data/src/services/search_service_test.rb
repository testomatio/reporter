require 'test_helper'

class SearchServiceTest < ActiveSupport::TestCase
  let(:project) { Project.create title: 'Project 1' }
  let(:seeder) { Seeder.new project }
  let(:search_service) { SearchService.new project }

  before(:each) do
    s = seeder.create_suite title: 'User Management'
    seeder.create_test suite: s, title: 'Login @auth', state: :automated
    seeder.create_test suite: s, title: 'Login without password @auth'
    seeder.create_test suite: s, title: 'Logout @auth'
    seeder.create_test suite: s, title: 'Disable authorization', state: :automated
    seeder.create_test suite: s, title: 'Delete account'

    s2 = seeder.create_suite title: 'Product'
    seeder.create_test suite: s2, title: 'Create product'

    Suite.reindex!
    Test.reindex!
  end

  test 'should search tests by title' do
    Retryable.retryable(tries: 5) do
      serialized = search_service.find_tests_and_suites 'Login'
      _(serialized[:included].length).must_equal 2
      _(found_tests(serialized)).must_include 'Login @auth'
    end
  end

  test 'should search tests by tag' do
    Retryable.retryable(tries: 5) do
      serialized = search_service.find_tests_and_suites '@auth'
      assert serialized[:included]
      _(serialized[:included].length).must_equal 3
      _(found_tests(serialized)).wont_include 'Disable authorization'
    end
  end

  test 'should search tests by title and state' do
    Retryable.retryable(tries: 5) do
      serialized = search_service.find_tests_and_suites 'Login', { state: 'automated' }
      _(serialized[:included].length).must_equal 1
      _(found_tests(serialized)).must_include 'Login @auth'
    end
  end

  test 'should filter tests by state' do
    serialized = search_service.filter_tests state: 'automated'
    _(serialized[:included].length).must_equal 2
  end

  test 'should filter tests by empty state' do
    sleep 0.3
    Retryable.retryable(tries: 5) do
      serialized = search_service.filter_tests state: ''
      _(serialized[:included].length).must_equal 6
    end
  end

  test 'should take description into account' do
    test = project.tests.find_by title: 'Logout @auth'
    test.description = 'User account must exist'
    test.save
    Retryable.retryable(tries: 5) do
      test.index!
      sleep 0.25
      serialized = search_service.find_tests_and_suites 'Account'
      echo Test.pluck(:title, :description)
      _(serialized[:included].length).must_equal 2
      _(found_tests(serialized)).must_include 'Logout @auth'
    end
  end

  test 'should ignore tags in description' do
    test = project.tests.find_by title: 'Delete account'
    test.description = 'This is also @auth'
    test.save
    Retryable.retryable(tries: 5) do
      serialized = search_service.find_tests_and_suites '@auth'
      _(serialized[:included].length).must_equal 3
      _(found_tests(serialized)).wont_include 'Delete account'
    end
  end

  test 'find tests in suites by tag' do
    s2 = project.suites.last
    s3 = seeder.create_suite title: 'Cart @slow @important'
    seeder.create_test suite: s3, title: 'Add to cart'
    seeder.create_test suite: s3, title: 'Remove from cart @slow'
    seeder.create_test suite: s3, title: 'Add more to cart'

    seeder.create_test suite: s2, title: 'Add exclusve product @important'
    TagsService.new(project).rebuild_project_tags
    tests = search_service.find_tests '@important'
    echo tests.pluck(:title)
    _(tests.length).must_equal 4
    _(tests.pluck(:title)).must_include 'Add exclusve product @important'
    _(tests.pluck(:title)).must_include 'Add to cart'
  end

  test 'should find tests on a branch' do
    test = project.tests.find_by title: 'Delete account'
    branch = project.branches.create title: 'dev'
    switch_to_branch branch
    test.title = 'Remove account'
    test.save

    sleep 0.25
    Retryable.retryable(tries: 10) do
      serialized = search_service.find_tests_and_suites 'Delete'
      echo serialized[:included]
      # well, maybe we should not show it but ok :(
      _(serialized[:included].length).must_equal 1

      serialized = search_service.find_tests_and_suites 'Remove'
      _(serialized[:included].length).must_equal 1
    end
  end

  test 'should search globally by title' do
    sleep 0.25
    Retryable.retryable(tries: 10) do
      suites = SearchService.global_find_tests_and_suites('Login', [project])
      _(suites.size).must_equal 1
      _(suites.first[:filtered_tests].size).must_equal 2

      suites = SearchService.global_find_tests_and_suites('@auth', [project])
      _(suites.size).must_equal 1
      echo suites.first[:filtered_tests]

      # actually should be 3, because result also includes 'authorization' word
      _(suites.first[:filtered_tests].size).must_equal 4

      suites = SearchService.global_find_tests_and_suites('Hello', [project])
      _(suites.size).must_equal 0
    end
  end

  private

  def found_tests(serialized)
    assert serialized[:included]
    serialized[:included].map { |t| t[:attributes][:title] }
  end
end
